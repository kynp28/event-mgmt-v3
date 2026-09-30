import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const prisma = new PrismaClient();

function normalize(text) {
  return text
    .replace(/c[a-z0-9]{24}/g, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TS>')
    .replace(/\b\d+ms\b/g, '<MS>')
    .replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '<TOKEN>')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g, '<UUID>')
    .replace(/[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^)]+\)/g, '<TS>');
}

async function main() {
  if (!process.env.LEGACY_DATABASE_URL?.includes('eventcore_test')) {
    console.error('Error: LEGACY_DATABASE_URL must contain "eventcore_test"');
    process.exit(1);
  }
  
  process.env.DATABASE_URL = process.env.LEGACY_DATABASE_URL;

  const scriptsDir = process.cwd();
  const rootDir = path.resolve(scriptsDir, '../..');
  const logsDir = path.join(rootDir, 'docs', 'baseline-logs');
  
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  let runs = 1;
  let compareMode = false;
  
  const args = process.argv.slice(2);
  let scriptNames = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runs') {
      runs = parseInt(args[++i], 10);
    } else if (args[i] === '--compare') {
      compareMode = true;
    } else {
      scriptNames.push(args[i]);
    }
  }

  if (scriptNames.length === 0) {
    const gitOutput = execSync('git ls-files test-*.js', { cwd: scriptsDir }).toString();
    scriptNames = gitOutput.split('\n').map(s => s.trim()).filter(s => s);
  }

  const results = [];
  let compareFailed = false;

  for (const script of scriptNames) {
    const scriptResults = [];
    let scriptClassification = 'NOT RUNNABLE';
    const outputs = [];
    
    for (let r = 1; r <= runs; r++) {
      console.log(`\n=== Running ${script} (Run ${r}/${runs}) ===`);
      
      console.log('Dropping all tables...');
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
      const tables = await prisma.$queryRaw`
        SELECT TABLE_NAME 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE();
      `;
      for (const { TABLE_NAME } of tables) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${TABLE_NAME}\`;`);
      }
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);

      console.log('Migrating and seeding...');
      execSync('npx prisma migrate deploy', { cwd: scriptsDir, stdio: 'ignore' });
      execSync('npx tsx prisma/seed.ts', { cwd: scriptsDir, stdio: 'ignore' });

      const secret = crypto.randomBytes(16).toString('hex');
      const env = { ...process.env, JOBS_SECRET: secret };

      try {
        execSync('netstat -ano | findstr :4000 | findstr LISTENING');
        console.error('Error: Port 4000 is not free before starting the server.');
        process.exit(1);
      } catch (e) {}

      console.log('Starting server...');
      const serverProcess = spawn('npx.cmd', ['tsx', 'src/index.ts'], { cwd: scriptsDir, env, shell: true });
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server start timeout')), 60000);
        const poll = () => {
          http.get('http://localhost:4000/api/health', (res) => {
            if (res.statusCode === 200) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(poll, 500);
            }
          }).on('error', () => setTimeout(poll, 500));
        };
        poll();
      });

      console.log('Server is healthy. Running script...');
      
      let exitCode = 0;
      let output = '';
      try {
        const out = execSync(`node ${script}`, { cwd: scriptsDir, env, stdio: 'pipe' });
        output = out.toString();
      } catch (e) {
        exitCode = e.status || 1;
        output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
      }

      const normalized = normalize(output);
      outputs.push({ exitCode, normalized, raw: output });
      scriptResults.push(exitCode);

      console.log('Stopping server...');
      execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' });

      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        execSync('netstat -ano | findstr :4000 | findstr LISTENING');
        console.error('Error: Port 4000 is still in use (LISTENING) after stopping server.');
        process.exit(1);
      } catch (e) {}
    }

    const allExit0 = outputs.every(o => o.exitCode === 0);
    const allFail = outputs.every(o => o.exitCode !== 0);
    const allIdentical = outputs.every(o => o.normalized === outputs[0].normalized);
    const allExitIdentical = outputs.every(o => o.exitCode === outputs[0].exitCode);

    if (outputs.length > 0) {
      if (allExit0 && allIdentical) {
        scriptClassification = 'DETERMINISTIC';
      } else if (allFail && allIdentical) {
        scriptClassification = 'FAIL';
      } else {
        scriptClassification = 'FLAKY';
      }
    }

    results.push({ script, classification: scriptClassification, exitCodes: scriptResults.join(',') });
    console.log(`Classification for ${script}: ${scriptClassification}`);

    if (scriptClassification === 'DETERMINISTIC') {
      const logPath = path.join(logsDir, `${script}.log`);
      if (compareMode) {
        if (!existsSync(logPath)) {
          console.error(`Compare mode: Reference log missing for ${script}`);
          compareFailed = true;
        } else {
          const ref = readFileSync(logPath, 'utf8');
          if (ref !== outputs[0].normalized) {
            console.error(`Compare mode: Output mismatch for ${script}`);
            compareFailed = true;
          } else {
            console.log(`Compare mode: ${script} matches reference log.`);
          }
        }
      } else {
        writeFileSync(logPath, outputs[0].normalized);
        console.log(`Saved reference log to ${logPath}`);
      }
    } else if (scriptClassification === 'FLAKY') {
      console.log(`FLAKY DETECTED for ${script}.`);
      writeFileSync(path.join(logsDir, `${script}.flaky.log`), outputs.map((o,i) => `--- Run ${i+1} ---\n${o.normalized}`).join('\n\n'));
    } else if (scriptClassification === 'FAIL') {
      writeFileSync(path.join(logsDir, `${script}.fail.log`), outputs[0].raw);
    }
  }

  console.log('\n=== Final Results ===');
  console.table(results);
  if (compareMode && compareFailed) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(console.error);
