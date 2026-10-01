// @ts-check
import fs from 'fs';
import path from 'path';

/**
 * Classifies a script based on its outputs.
 * @param {string} script 
 * @param {Array<{exitCode: number, normalized: string, raw: string}>} outputs 
 * @returns {string} Classification: 'RACE-DEPENDENT', 'DETERMINISTIC', 'FAIL', 'FLAKY', 'TIMEOUT', or 'NOT RUNNABLE'
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
  const reasons = [];
  
  if (requestedRuns < 3) {
    reasons.push(`Requested runs (${requestedRuns}) < 3. Reference update requires at least 3 runs.`);
  }

  for (const r of results) {
    const isAllowlisted = Object.prototype.hasOwnProperty.call(allowlist, r.script);
    
    if (r.classification === 'NOT RUNNABLE' || r.classification === 'TIMEOUT') {
      reasons.push(`Script ${r.script} is ${r.classification}.`);
    }
    
    if (r.outputs.length < requestedRuns) {
      reasons.push(`Script ${r.script} has fewer runs (${r.outputs.length}) than requested (${requestedRuns}).`);
    }

    if (!isAllowlisted && r.classification === 'FLAKY') {
      reasons.push(`Non-allowlisted script ${r.script} is FLAKY.`);
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
 * @param {Record<string, string>} allowlist 
 */
export function cleanupStaleFiles(script, classification, logsDir, allowlist) {
  const filesToDelete = [];
  const isAllowlisted = allowlist && Object.prototype.hasOwnProperty.call(allowlist, script);
  
  if (classification !== 'DETERMINISTIC' && !isAllowlisted) {
    filesToDelete.push(path.join(logsDir, `${script}.log`));
  }
  if (classification !== 'RACE-DEPENDENT') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.race-outcomes.md`));
  }
  if (classification !== 'FLAKY') {
    filesToDelete.push(path.join(logsDir, 'evidence', `${script}.flaky.log`));
  }
  if (classification !== 'FAIL' && !isAllowlisted) {
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

/**
 * Checks if a port is in the LISTENING state from netstat output.
 * @param {string} netstatText 
 * @param {number} port 
 * @returns {boolean}
 */
export function isPortListening(netstatText, port) {
  const lines = netstatText.split('\n');
  const regex = new RegExp(`:${port}\\b\\s+.*LISTENING`, 'i');
  for (const line of lines) {
    if (regex.test(line)) return true;
  }
  return false;
}

/**
 * Normalizes output logs to remove timestamps, UUIDs, etc.
 * @param {string} text 
 * @returns {string}
 */
export function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/c[a-z0-9]{24}/g, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TS>')
    .replace(/\b\d+ms\b/g, '<MS>')
    .replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '<TOKEN>')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g, '<UUID>')
    .replace(/[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \([^)]+\)/g, '<TS>');
}

import http from 'http';

export function waitForHealth(url, timeoutMs, { intervalMs = 500 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer;
    let currentReq = null;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(pollTimer);
      if (currentReq) currentReq.destroy();
      reject(new Error(`Server start timeout after ${timeoutMs} ms`));
    }, timeoutMs);

    const poll = () => {
      if (settled) return;
      currentReq = http.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        if (settled) return;
        if (res.statusCode === 200) {
          settled = true;
          clearTimeout(timeout);
          clearTimeout(pollTimer);
          resolve(true);
        } else {
          pollTimer = setTimeout(poll, intervalMs);
        }
      });

      currentReq.on('timeout', () => {
        if (currentReq) currentReq.destroy();
      });

      currentReq.on('error', () => {
        if (settled) return;
        pollTimer = setTimeout(poll, intervalMs);
      });
    };

    poll();
  });
}

export function shouldWriteReference(script, classification, allowlist) {
  const isAllowlisted = Object.prototype.hasOwnProperty.call(allowlist, script);
  if (isAllowlisted) {
    return classification === 'FAIL';
  }
  return true;
}
