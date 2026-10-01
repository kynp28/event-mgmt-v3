import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, openSync, closeSync } from 'fs';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import { classify, validateReferenceUpdate, cleanupStaleFiles } from './baseline-lib.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/c[a-z0-9]{24}/g, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TS>')
    .replace(/\b\d+ms\b/g, '<MS>')
    .replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '<TOKEN>')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g, '<UUID>')
    .replace(/[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^)]+\)/g, '<TS>');
}

async function main() {
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  if (!legacyUrl) {
    throw new Error('Error: LEGACY_DATABASE_URL is required');
  }
  let dbName;
  try {
    dbName = new URL(legacyUrl).pathname.substring(1);
  } catch (e) {
    throw new Error('Error: LEGACY_DATABASE_URL must be a valid URL');
  }
  if (dbName !== 'eventcore_test_legacy') {
    throw new Error(`Error: Refusing to run. LEGACY_DATABASE_URL database name must be exactly 'eventcore_test_legacy'. Found: '${dbName}'`);
  }
  const regularUrl = process.env.DATABASE_URL;
  if (regularUrl) {
    let regularDbName = '';
    try { regularDbName = new URL(regularUrl).pathname.substring(1); } catch (e) {}
    if (dbName === regularDbName) {
      throw new Error(`Error: Refusing to run. LEGACY_DATABASE_URL database name equals DATABASE_URL database name: '${dbName}'`);
    }
  }
  console.log(`Database guarded: ${dbName}`);
  process.env.DATABASE_URL = legacyUrl;

  const prisma = new PrismaClient({ datasourceUrl: legacyUrl });

  const scriptsDir = process.cwd();
  const rootDir = path.resolve(scriptsDir, '../..');
  const logsDir = path.join(rootDir, 'docs', 'baseline-logs');
  const perRunLogsDir = path.join(scriptsDir, '.baseline-logs');
  const knownFailuresFile = path.join(rootDir, 'docs', 'baseline-known-failures.json');
  
  if (!existsSync(perRunLogsDir)) mkdirSync(perRunLogsDir, { recursive: true });

  let knownFailures = {};
  if (existsSync(knownFailuresFile)) {
    knownFailures = JSON.parse(readFileSync(knownFailuresFile, 'utf8'));
  }
  
  let runs = 1;
  let compareMode = false;
  let updateReference = false;
  
  const args = process.argv.slice(2);
  let scriptNames = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runs') {
      runs = parseInt(args[++i], 10);
    } else if (args[i] === '--compare') {
      compareMode = true;
    } else if (args[i] === '--update-reference') {
      updateReference = true;
    } else {
      scriptNames.push(args[i]);
    }
  }

  if (updateReference && runs < 3) {
    throw new Error(`Error: --update-reference requires at least 3 runs, but ${runs} requested.`);
  }

  const gitOutput = execSync('git ls-files test-*.js', { cwd: scriptsDir }).toString();
  const validScripts = gitOutput.split('\n').map(s => s.trim()).filter(s => s);

  if (scriptNames.length === 0) {
    scriptNames = validScripts;
  } else {
    for (const name of scriptNames) {
      if (!validScripts.includes(name)) {
        throw new Error(`Error: Unknown script '${name}'. Must be tracked in git as test-*.js`);
      }
    }
  }

  const results = [];
  let compareFailed = false;
  
  const healthTimeoutMs = process.env.BASELINE_HEALTH_TIMEOUT_MS ? parseInt(process.env.BASELINE_HEALTH_TIMEOUT_MS, 10) : 60000;
  const scriptTimeoutMs = process.env.BASELINE_SCRIPT_TIMEOUT_MS ? parseInt(process.env.BASELINE_SCRIPT_TIMEOUT_MS, 10) : 120000;

  let tmpDir = null;
  if (compareMode) {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'baseline-'));
  }

  const rawResultsMap = [];

  try {
    for (const script of scriptNames) {
      const scriptResults = [];
      const outputs = [];
      
      for (let r = 1; r <= runs; r++) {
        console.log(`\n=== Running ${script} (Run ${r}/${runs}) ===`);
        
        console.log(`Dropping all tables in ${dbName}...`);
        await prisma.$transaction(async (tx) => {
          const dbCheck = await tx.$queryRaw`SELECT DATABASE() as db`;
          if (dbCheck[0].db !== 'eventcore_test_legacy') {
            throw new Error(`Guard failed inside transaction: Expected eventcore_test_legacy, got ${dbCheck[0].db}`);
          }
          await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
          try {
            const tables = await tx.$queryRaw`
              SELECT TABLE_NAME 
              FROM information_schema.tables 
              WHERE table_schema = DATABASE();
            `;
            for (const { TABLE_NAME } of tables) {
              await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${TABLE_NAME}\`;`);
            }
          } finally {
            await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
          }
        }, { maxWait: 10000, timeout: 60000 });

        console.log('Migrating and seeding...');
        execSync('npx prisma migrate deploy', { cwd: scriptsDir, stdio: 'ignore' });
        execSync('npx tsx prisma/seed.ts', { cwd: scriptsDir, stdio: 'ignore' });

        const secret = crypto.randomBytes(16).toString('hex');
        const env = { ...process.env, JOBS_SECRET: secret };

        try {
          execSync('netstat -ano | findstr :4000 | findstr LISTENING');
          throw new Error('Error: Port 4000 is not free before starting the server.');
        } catch (e) {
          if (e.message.includes('Port 4000 is not free')) throw e;
        }

        console.log('Starting server...');
        const serverLogFile = path.join(perRunLogsDir, `server.${script}.run${r}.log`);
        const outFd = openSync(serverLogFile, 'w');
        const serverProcess = spawn('npx.cmd', ['tsx', 'src/index.ts'], { cwd: scriptsDir, env, shell: true, stdio: ['ignore', outFd, outFd] });
        serverProcess.unref();
        closeSync(outFd);
        
        try {
          await new Promise((resolve, reject) => {
            let pollTimer;
            let currentReq;
            const timeout = setTimeout(() => {
              clearTimeout(pollTimer);
              if (currentReq) currentReq.destroy();
              reject(new Error(`Server start timeout at line 155`));
            }, healthTimeoutMs);
            const poll = () => {
              currentReq = http.get('http://localhost:4000/api/health', (res) => {
                if (res.statusCode === 200) {
                  res.resume();
                  clearTimeout(timeout);
                  resolve();
                } else {
                  res.resume();
                  pollTimer = setTimeout(poll, 500);
                }
              }).on('error', () => { pollTimer = setTimeout(poll, 500); });
            };
            poll();
          });

          console.log('Server is healthy. Running script...');
          
          let exitCode = 0;
          let output = '';
          try {
            const out = execSync(`node ${script}`, { cwd: scriptsDir, env, stdio: 'pipe', timeout: scriptTimeoutMs, maxBuffer: 16 * 1024 * 1024 });
            output = out.toString();
          } catch (e) {
            if (e.code === 'ETIMEDOUT' || (e.signal === 'SIGTERM')) {
              exitCode = -1;
              output = 'TIMEOUT';
            } else {
              exitCode = e.status || 1;
              output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
            }
          }

          const normalized = normalize(output);
          outputs.push({ exitCode, normalized, raw: output });
          scriptResults.push(exitCode);

          writeFileSync(path.join(perRunLogsDir, `${script}.run${r}.raw.log`), output);

        } finally {
          console.log('Stopping server...');
          try {
            execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
          } catch (e) {}
          try { serverProcess.kill('SIGKILL'); } catch (e) {}

          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            execSync('netstat -ano | findstr :4000 | findstr LISTENING');
            throw new Error('Error: Port 4000 is still in use (LISTENING) after stopping server.');
          } catch (e) {
            if (e.message.includes('Port 4000 is still in use')) throw e;
          }
        }
      }

      const scriptClassification = classify(script, outputs);
      rawResultsMap.push({ script, classification: scriptClassification, outputs });
      results.push({ script, classification: scriptClassification, runs, exitCodes: scriptResults.join(',') });
      console.log(`Classification for ${script}: ${scriptClassification}`);
    }

    const isAllowlistedFn = (script) => knownFailures.hasOwnProperty(script);

    let writeSafe = false;
    if (updateReference) {
      const validation = validateReferenceUpdate(rawResultsMap, knownFailures, runs);
      if (!validation.safe) {
        console.error(`\nError: Refusing to update references. Reasons:\n- ${validation.reasons.join('\n- ')}`);
        process.exitCode = 1;
        return; // Early return to skip writing, finally block will run
      }
      writeSafe = true;
    }

    for (const r of rawResultsMap) {
      const { script, classification, outputs } = r;
      const isAllowlisted = isAllowlistedFn(script);
      
      if (classification === 'TIMEOUT') {
        console.error(`TIMEOUT DETECTED for ${script}. Exceeded ${scriptTimeoutMs}ms.`);
        if (compareMode) {
          compareFailed = true;
        }
        if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          if (!existsSync(path.join(logsDir, 'evidence'))) mkdirSync(path.join(logsDir, 'evidence'), { recursive: true });
          writeFileSync(path.join(logsDir, 'evidence', `${script}.timeout.log`), `TIMEOUT after ${scriptTimeoutMs}ms`);
        }
      } else if (classification === 'DETERMINISTIC') {
        const logPath = path.join(logsDir, `${script}.log`);
        if (compareMode) {
          if (isAllowlisted) {
            console.log(`Notice: Allowlisted script ${script} exited with 0 (DETERMINISTIC).`);
          } else {
            if (!existsSync(logPath)) {
              console.error(`Compare mode: Reference log missing for ${script}`);
              compareFailed = true;
            } else {
              const ref = normalize(readFileSync(logPath, 'utf8'));
              if (ref !== outputs[0].normalized) {
                console.error(`Compare mode: Output mismatch for ${script}`);
                const tmpActual = path.join(tmpDir, `${script}.actual.log`);
                writeFileSync(tmpActual, outputs[0].normalized);
                try {
                  execSync(`git diff --no-index "${logPath}" "${tmpActual}"`, { stdio: 'inherit' });
                } catch (e) {}
                compareFailed = true;
              } else {
                console.log(`Compare mode: ${script} matches reference log.`);
              }
            }
          }
        } else if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          writeFileSync(logPath, outputs[0].normalized);
          console.log(`Saved reference log to ${logPath}`);
        }
      } else if (classification === 'RACE-DEPENDENT') {
        console.log(`RACE-DEPENDENT script ${script}.`);
        if (compareMode) {
          console.log(`Compare mode: Skipping RACE-DEPENDENT script ${script}`);
        } else if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          if (!existsSync(path.join(logsDir, 'evidence'))) mkdirSync(path.join(logsDir, 'evidence'), { recursive: true });
          const distinct = {};
          for (const o of outputs) {
            distinct[o.normalized] = (distinct[o.normalized] || 0) + 1;
          }
          let raceLog = "";
          let i = 1;
          for (const [norm, count] of Object.entries(distinct)) {
            raceLog += `--- Distinct Output ${i} (Seen ${count} times) ---\n${norm}\n\n`;
            i++;
          }
          writeFileSync(path.join(logsDir, 'evidence', `${script}.race-outcomes.md`), raceLog);
        }
      } else if (classification === 'FLAKY') {
        console.log(`FLAKY DETECTED for ${script}.`);
        if (compareMode && !isAllowlisted) compareFailed = true;
        if (isAllowlisted) console.log(`KNOWN FAIL (allowlisted)`);
        
        if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          if (!existsSync(path.join(logsDir, 'evidence'))) mkdirSync(path.join(logsDir, 'evidence'), { recursive: true });
          writeFileSync(path.join(logsDir, 'evidence', `${script}.flaky.log`), outputs.map((o,i) => `--- Run ${i+1} ---\n${o.normalized}`).join('\n\n'));
        }
      } else if (classification === 'FAIL') {
        if (compareMode && !isAllowlisted) {
          console.error(`Error: Non-allowlisted script ${script} failed.`);
          compareFailed = true;
        }
        if (isAllowlisted) console.log(`KNOWN FAIL (allowlisted)`);
        if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          if (!existsSync(path.join(logsDir, 'evidence'))) mkdirSync(path.join(logsDir, 'evidence'), { recursive: true });
          writeFileSync(path.join(logsDir, 'evidence', `${script}.fail.log`), outputs[0].raw);
        }
      }
    }

    console.log('\n=== Final Results ===');
    console.table(results);
    
    if (writeSafe) {
      console.log('\n=== Reference Updates ===');
      try {
        execSync('git diff --stat -- docs/baseline-logs', { stdio: 'inherit', cwd: rootDir });
      } catch (e) {}
    }

    if (compareMode && compareFailed) {
      process.exitCode = 1;
    }
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }
    await prisma.$disconnect();
  }
}

main().then(() => console.log('MAIN EXITED')).catch(e => {
  console.error(e);
  process.exitCode = 1;
});
