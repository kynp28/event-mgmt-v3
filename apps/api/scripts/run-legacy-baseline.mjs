import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import http from 'http';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.includes('eventcore_test')) {
    console.error('Error: DATABASE_URL must contain "eventcore_test"');
    process.exit(1);
  }

  const scriptsDir = path.join(process.cwd(), 'apps', 'api');
  let scriptNames = process.argv.slice(2);
  
  if (scriptNames.length === 0) {
    const fs = await import('fs');
    scriptNames = fs.readdirSync(scriptsDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));
  }

  const logsDir = path.join(scriptsDir, '.baseline-logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir);
  }

  const results = [];

  for (const script of scriptNames) {
    console.log(`\n=== Running ${script} ===`);
    
    // 1. Drop all tables
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

    // 2. Migrate & Seed
    console.log('Migrating and seeding...');
    execSync('npx prisma migrate deploy', { cwd: scriptsDir, stdio: 'ignore' });
    execSync('npx tsx prisma/seed.ts', { cwd: scriptsDir, stdio: 'ignore' });

    // 3. Generate JOBS_SECRET
    const secret = crypto.randomBytes(16).toString('hex');
    const env = { ...process.env, JOBS_SECRET: secret };

    // 4. Check if port is free before start
    try {
      execSync('netstat -ano | findstr :4000');
      console.error('Error: Port 4000 is not free before starting the server.');
      process.exit(1);
    } catch (e) {
      // Good, it threw meaning findstr didn't find :4000
    }

    // 5. Start API
    console.log('Starting server...');
    const serverProcess = spawn('npx', ['tsx', 'src/index.ts'], { cwd: scriptsDir, env, shell: true });
    
    // Poll health check
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

    // Save log
    const logPath = path.join(logsDir, `${script}.log`);
    writeFileSync(logPath, output);
    console.log(`Saved log to ${logPath}`);

    // Stop server
    console.log('Stopping server...');
    execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' });

    // Confirm port is free
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for OS to free port
    try {
      execSync('netstat -ano | findstr :4000');
      console.error('Error: Port 4000 is still in use after stopping server.');
      process.exit(1);
    } catch (e) {
      // Good, port is free
    }

    const result = exitCode === 0 ? 'PASS' : 'FAIL';
    results.push({ script, exitCode, result });
    console.log(`Result: ${result} (Exit code: ${exitCode})`);
  }

  console.log('\n=== Final Results ===');
  console.table(results);
  process.exit(0);
}

main().catch(console.error);
