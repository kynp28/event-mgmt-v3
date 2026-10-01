import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, openSync, closeSync, readdirSync, statSync } from 'fs';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import { classify, validateReferenceUpdate, cleanupStaleFiles, isPortListening, normalize } from './baseline-lib.mjs';

async function main() {
  const rootDir = path.resolve(process.cwd(), '../..');
  const scriptsDir = path.join(rootDir, 'apps', 'api');
  
  const allowlistPath = path.join(rootDir, 'docs', 'baseline-known-failures.json');
  const logsDir = path.join(rootDir, 'docs', 'baseline-logs');
  
  if (!existsSync(allowlistPath)) {
    throw new Error('Error: Missing baseline-known-failures.json allowlist');
  }
  if (!existsSync(logsDir)) {
    throw new Error('Error: Missing docs/baseline-logs directory');
  }

  const perRunLogsDir = path.join(scriptsDir, '.baseline-logs');
  if (!existsSync(perRunLogsDir)) mkdirSync(perRunLogsDir, { recursive: true });

  dotenv.config({ path: path.join(scriptsDir, '.env.test') });
  const legacyUrlStr = process.env.LEGACY_DATABASE_URL;
  if (!legacyUrlStr) {
    throw new Error('Error: LEGACY_DATABASE_URL is required');
  }

  let dbName;
  try {
    const parsed = new URL(legacyUrlStr);
    dbName = parsed.pathname.slice(1);
  } catch (e) {
    throw new Error('Error: LEGACY_DATABASE_URL must be a valid URL');
  }
  if (dbName !== 'eventcore_test_legacy') {
    throw new Error(`Error: Refusing to run. LEGACY_DATABASE_URL database name must be exactly 'eventcore_test_legacy'. Found: '${dbName}'`);
  }
  
  const normalDbName = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : '';
  if (dbName === normalDbName) {
    throw new Error(`Error: Refusing to run. LEGACY_DATABASE_URL database name equals DATABASE_URL database name: '${dbName}'`);
  }

  process.env.DATABASE_URL = legacyUrlStr;
  const prisma = new PrismaClient({ datasourceUrl: legacyUrlStr });

  let compareMode = false;
  let updateReference = false;
  let runs = 1;
  const targetScripts = [];

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--compare') compareMode = true;
    else if (args[i] === '--update-reference') updateReference = true;
    else if (args[i] === '--runs') runs = parseInt(args[++i], 10);
    else if (!args[i].startsWith('--')) targetScripts.push(args[i]);
  }

  let allowlist = {};
  allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));

  const scriptTimeoutMs = parseInt(process.env.BASELINE_SCRIPT_TIMEOUT_MS || '120000', 10);
  const healthTimeoutMs = parseInt(process.env.BASELINE_HEALTH_TIMEOUT_MS || '60000', 10);

  let tmpDir = null;

  try {
    let scriptNames = [];
    const allFiles = execSync('git ls-files test-*.js', { cwd: scriptsDir }).toString().split('\n').filter(Boolean);
    if (targetScripts.length > 0) {
      for (const s of targetScripts) {
        if (!allFiles.includes(s)) throw new Error(`Error: Unknown script '${s}'. Must be tracked in git as test-*.js`);
        scriptNames.push(s);
      }
    } else {
      scriptNames = allFiles;
    }
    
    if (compareMode) {
      tmpDir = mkdtempSync(path.join(os.tmpdir(), 'baseline-'));
    }

    const results = [];
    const rawResultsMap = [];
    let compareFailed = false;

    for (const script of scriptNames) {
      const scriptResults = [];
      const outputs = [];
      const startTime = Date.now();
      
      for (let r = 1; r <= runs; r++) {
        console.log(`\n=== Running ${script} (Run ${r}/${runs}) ===`);
        
        const netstatCheck = execSync('netstat -ano', { stdio: 'pipe' }).toString();
        if (isPortListening(netstatCheck, 4000)) {
          throw new Error('Error: Port 4000 is not free before starting the server.');
        }

        await prisma.$transaction(async (tx) => {
          const dbCheck = await tx.$queryRaw`SELECT DATABASE() as db_name`;
          if (dbCheck[0].db_name !== 'eventcore_test_legacy') {
            throw new Error(`Database is not eventcore_test_legacy! Found ${dbCheck[0].db_name}`);
          }

          const tables = await tx.$queryRaw`
            SELECT table_name as tname
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';
          `;
          if (tables.length > 0) {
            await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
            try {
              for (const { tname } of tables) {
                await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${tname}\`;`);
              }
            } finally {
              await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
            }
          }
        }, { maxWait: 10000, timeout: 60000 });

        console.log('Migrating and seeding...');
        execSync('npx prisma migrate deploy', { stdio: 'ignore', cwd: scriptsDir });
        execSync('npx tsx prisma/seed.ts', { stdio: 'ignore', cwd: scriptsDir });

        const jobsSecret = crypto.randomBytes(32).toString('hex');
        const env = { ...process.env, JOBS_SECRET: jobsSecret };

        console.log('Starting server...');
        const serverLogFile = path.join(perRunLogsDir, `server.${script}.run${r}.log`);
        const outFd = openSync(serverLogFile, 'w');
        const serverProcess = spawn('npx.cmd', ['tsx', 'src/index.ts'], {
          cwd: scriptsDir,
          env,
          stdio: ['ignore', outFd, outFd],
          shell: true,
          detached: false
        });
        serverProcess.unref();

        let serverHealthy = false;
        let pollTimer;
        try {
          await new Promise((resolve, reject) => {
            let currentReq;
            const timeout = setTimeout(() => {
              clearTimeout(pollTimer);
              if (currentReq) currentReq.destroy();
              reject(new Error(`Server start timeout after ${healthTimeoutMs} ms`));
            }, healthTimeoutMs);
            const poll = () => {
              currentReq = http.get('http://127.0.0.1:4000/api/health', (res) => {
                if (res.statusCode === 200) {
                  res.resume();
                  clearTimeout(timeout);
                  resolve(true);
                } else {
                  res.resume();
                  pollTimer = setTimeout(poll, 500);
                }
              }).on('error', () => { pollTimer = setTimeout(poll, 500); });
            };
            poll();
          });
          serverHealthy = true;
          console.log('Server is healthy. Running script...');
        } catch (e) {
          console.error(e.message);
        }

        if (serverHealthy) {
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
        }

        console.log('Stopping server...');
        if (serverProcess.pid) {
          try { execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' }); } catch(e) {}
        }
        closeSync(outFd);
        
        let portFree = false;
        for (let i = 0; i < 10; i++) {
          const netstatCheck = execSync('netstat -ano', { stdio: 'pipe' }).toString();
          if (!isPortListening(netstatCheck, 4000)) {
            portFree = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!portFree) {
          throw new Error('Error: Port 4000 is not free after killing server.');
        }
      }

      const elapsed = Date.now() - startTime;
      const scriptClassification = classify(script, outputs);
      rawResultsMap.push({ script, classification: scriptClassification, outputs });
      results.push({ script, classification: scriptClassification, runs, durationMs: elapsed, exitCodes: scriptResults.join(',') });
      console.log(`Classification for ${script}: ${scriptClassification}`);
    }

    const isAllowlistedFn = (s) => Object.prototype.hasOwnProperty.call(allowlist, s);

    let writeSafe = false;
    if (updateReference) {
      const validation = validateReferenceUpdate(rawResultsMap, allowlist, runs);
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
      
      let compareFailedForScript = false;

      if (classification === 'NOT RUNNABLE') {
        console.error(`NOT RUNNABLE DETECTED for ${script}.`);
        if (compareMode) {
          compareFailedForScript = true;
          compareFailed = true;
        }
      } else if (classification === 'TIMEOUT') {
        console.error(`TIMEOUT DETECTED for ${script}. Exceeded ${scriptTimeoutMs}ms.`);
        if (compareMode) {
          compareFailedForScript = true;
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
              compareFailedForScript = true;
              compareFailed = true;
            } else {
              const ref = readFileSync(logPath, 'utf8');
              if (ref !== outputs[0].normalized) {
                console.error(`Compare mode: Output mismatch for ${script}`);
                const tmpActual = path.join(tmpDir, `${script}.actual.log`);
                writeFileSync(tmpActual, outputs[0].normalized);
                try {
                  execSync(`git diff --no-index "${logPath}" "${tmpActual}"`, { stdio: 'inherit' });
                } catch (e) {}
                compareFailedForScript = true;
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
        if (compareMode && !isAllowlisted) {
          compareFailedForScript = true;
          compareFailed = true;
        }
        if (isAllowlisted) console.log(`KNOWN FAIL (allowlisted)`);
        
        if (writeSafe) {
          cleanupStaleFiles(script, classification, logsDir);
          if (!existsSync(path.join(logsDir, 'evidence'))) mkdirSync(path.join(logsDir, 'evidence'), { recursive: true });
          writeFileSync(path.join(logsDir, 'evidence', `${script}.flaky.log`), outputs.map((o,i) => `--- Run ${i+1} ---\n${o.normalized}`).join('\n\n'));
        }
      } else if (classification === 'FAIL') {
        if (compareMode && !isAllowlisted) {
          console.error(`Error: Non-allowlisted script ${script} failed.`);
          compareFailedForScript = true;
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

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
