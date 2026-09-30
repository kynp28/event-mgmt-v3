import fs from 'fs';
import path from 'path';

const logsDir = path.resolve(process.cwd(), '../../docs/baseline-logs');
if (!fs.existsSync(logsDir)) {
  console.error('Logs directory not found');
  process.exit(1);
}

const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
const results = [];
let mismatchFound = false;

for (const file of files) {
  const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Regex to match: <label>: <actual> (expected <expected>)
    // Example: "Booth status after double reject: AVAILABLE (expected AVAILABLE)"
    // Example: "Booking status in DB: PENDING_VERIFICATION (expected PENDING_VERIFICATION)"
    const match = line.match(/^(.+?):\s+(.+?)\s+\(expected\s+(.+?)\)$/);
    if (match) {
      const label = match[1].trim();
      const actual = match[2].trim();
      const expected = match[3].trim();
      
      const actualToken = actual.split(/\s+/)[0];
      const expectedTokens = expected.split(/[\s/]+/).map(t => t.trim()).filter(t => t);
      
      const verdict = expectedTokens.includes(actualToken) ? 'PASS' : 'FAIL';
      if (verdict === 'FAIL') mismatchFound = true;
      
      results.push({
        'Log File': file,
        'Line': index + 1,
        'Actual': actual,
        'Expected': expected,
        'Verdict': verdict
      });
    }
  });
}

console.table(results);
if (mismatchFound) {
  process.exit(1);
} else {
  process.exit(0);
}
