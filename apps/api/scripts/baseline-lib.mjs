// @ts-check
import fs from 'fs';
import path from 'path';

/**
 * Classifies a script based on its outputs.
 * @param {string} script 
 * @param {Array<{exitCode: number, normalized: string, raw: string}>} outputs 
 * @returns {string} Classification: 'RACE-DEPENDENT', 'DETERMINISTIC', 'FAIL', 'FLAKY', or 'TIMEOUT'
 */
export function classify(script, outputs) {
  if (outputs.length === 0) return 'NOT RUNNABLE';

  const anyTimeout = outputs.some(o => o.exitCode === -1 && o.raw === 'TIMEOUT');
  if (anyTimeout) return 'TIMEOUT';

  const allExit0 = outputs.every(o => o.exitCode === 0);
  const allFail = outputs.every(o => o.exitCode !== 0 && o.exitCode !== -1);
  const allIdentical = outputs.every(o => o.normalized === outputs[0].normalized);

  if (script === 'test-concurrency.js') {
    return 'RACE-DEPENDENT';
  } else if (allExit0 && allIdentical) {
    return 'DETERMINISTIC';
  } else if (allFail && allIdentical) {
    return 'FAIL';
  } else {
    return 'FLAKY';
  }
}

/**
 * Validates whether it is safe to write references.
 * @param {Array<{script: string, classification: string, outputs: Array<{exitCode: number, normalized: string}>}>} results 
 * @param {Record<string, string>} allowlist 
 * @param {number} requestedRuns 
 * @returns {{safe: boolean, reasons: string[]}}
 */
export function validateReferenceUpdate(results, allowlist, requestedRuns) {
  if (requestedRuns < 3) {
    return { safe: false, reasons: [`Requested runs (${requestedRuns}) < 3. Reference update requires at least 3 runs.`] };
  }

  const reasons = [];
  for (const r of results) {
    const isAllowlisted = Object.prototype.hasOwnProperty.call(allowlist, r.script);
    if (!isAllowlisted && (r.classification === 'FLAKY' || r.classification === 'TIMEOUT')) {
      reasons.push(`Non-allowlisted script ${r.script} is ${r.classification}.`);
    }
    if (r.classification === 'DETERMINISTIC') {
      const allIdentical = r.outputs.every(o => o.normalized === r.outputs[0].normalized);
      if (!allIdentical) {
        reasons.push(`DETERMINISTIC script ${r.script} has mismatching normalized outputs between runs.`);
      }
    }
  }

  return { safe: reasons.length === 0, reasons };
}

/**
 * Cleans up stale files when classification changes.
 * @param {string} script 
 * @param {string} classification 
 * @param {string} logsDir 
 */
export function cleanupStaleFiles(script, classification, logsDir) {
  const filesToDelete = [];
  
  if (classification !== 'DETERMINISTIC') {
    filesToDelete.push(path.join(logsDir, `${script}.log`));
  }
  if (classification !== 'RACE-DEPENDENT') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.race-outcomes.md`));
  }
  if (classification !== 'FLAKY') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.flaky.log`));
  }
  if (classification !== 'FAIL') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.fail.log`));
  }
  if (classification !== 'TIMEOUT') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.timeout.log`));
  }

  for (const file of filesToDelete) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
