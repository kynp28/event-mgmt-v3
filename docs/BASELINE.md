# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy` (or `baseline:compare` to verify against reference logs).
**Scan Expected:** `pnpm --filter api baseline:scan` (use `--include-evidence` to see output for FLAKY/FAIL scripts).
**Update Reference:** `pnpm --filter api baseline:update-reference` (explicit, reviewed via git diff before commit).

The runner performs the following steps for each script:
1. Validates the database is exactly `eventcore_test_legacy` and checks that the script name is valid.
2. Drops all tables using a pinned Prisma `$transaction` connection (`maxWait: 10000`, `timeout: 60000`). This shares a session for the guard and the drops, though drops are not atomically rollback-able. Foreign key checks are restored in a `finally` block.
3. Runs `npx prisma migrate deploy` and `npm run db:seed` against the legacy database. **Note: `organizer2@eventcore.com` and `org2@eventcore.com` (both APPROVED with profiles) were added to the seed to provide required fixtures.**
4. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
5. Starts the API server (without watch mode) and polls `/api/health` until it returns 200 (timeout configurable via `BASELINE_HEALTH_TIMEOUT_MS`, default 60000).
6. Runs the legacy script and normalizes its output. Script execution is bounded by `BASELINE_SCRIPT_TIMEOUT_MS` (default 120000). If it exceeds this, the script is classified as `TIMEOUT`.
7. Stops the server process tree cleanly and verifies port 4000 is free. This cleanup is guaranteed to run on every exit path.

**Important Rule:** The runner and Vitest are kept strictly sequential. The runner uses the isolated legacy database (`eventcore_test_legacy`) while Vitest uses `eventcore_test`. Although they use different databases, keeping them sequential ensures that timing-sensitive concurrency tests stay reliable and ports do not conflict.

**Explicit Note on Login Rate Limiting:**
The login endpoint imposes a strict rate limit (`windowMs: 15 * 60 * 1000, max: 10`). This requires a server restart between scripts when running them by hand. If run consecutively without a restart, the scripts rapidly exhaust the 10-login quota, resulting in 429 Too Many Requests, which previously caused misleading crashes (`TypeError: Cannot read properties of undefined (reading 'split')`).

## Gate Semantics
- **Allowlist (`docs/baseline-known-failures.json`)**: Tracks scripts that fail deterministically due to known bugs. Failures here do not fail the CI gate (they print "KNOWN FAIL (allowlisted)"). If an allowlisted script magically passes (exit 0), the gate prints a notice but does not fail.
- **Exit Code Rules (`baseline:compare`)**: The process exits non-zero if and only if a `DETERMINISTIC` script mismatches its reference log/crashes, or a script *not* in the allowlist fails/timeouts. Mismatch diffs are generated securely using temporary directories (in `%TEMP%`) and cleaned up automatically.
- **Scan Scope**: `baseline:scan` only checks logs directly inside `docs/baseline-logs` (which correspond to `DETERMINISTIC` scripts). It ignores logs in `evidence/` unless `--include-evidence` is passed. Scanning requires `CRLF` normalized to `LF` before matching and exits 1 if 0 expected-lines rows are found.
- **RACE-DEPENDENT**: Scripts whose output varies purely based on race conditions (e.g. concurrent HTTP requests) without any normalization gaps. They are excluded from `baseline:compare` checks. Their race outcomes are recorded in `evidence/`.

**Classification Authority:** A classification is authoritative ONLY when it comes from a 3-run `update-reference`. A 1-run `compare` (`--runs 1`, default) can only detect mismatches against the reference, not flakiness.

**Known limitations:** FAIL evidence logs are raw output and churn between runs; `race-outcomes.md` count comes from the earlier 10-run experiment (commit `38ab5b6`).

## Feature Acceptance Checklist
To accept a feature or fix, the following sequence must pass strictly sequentially:
1. `git status --porcelain` (Expected: empty)
2. `pnpm --filter api test` (Expected: 16 of 16 tests pass)
3. `pnpm --filter api baseline:compare` (Expected: exit code 0)
4. `pnpm --filter api test` (Expected: 16 of 16 tests pass, verifying DB state is preserved)
5. `pnpm --filter api baseline:scan` (Expected: exit code 0, no output/mismatches)

## Legacy Scripts Status
| Script | Classification | Passed | Known Mismatches | Cause / Coverage |
| --- | --- | --- | --- | --- |
| test-auth.js | DETERMINISTIC | 3/3 | none | - |
| test-concurrency.js | RACE-DEPENDENT | 10/10 | none | Depends on race between V1 and V2. Covered by Vitest `Booking Hold & Concurrency` suite. |
| test-endpoint-rules.js | FAIL | 0/3 | none | Foreign key constraint (organizerId) during Event creation |
| test-lists.js | DETERMINISTIC | 3/3 | none | - |
| test-missing-step5.js | DETERMINISTIC | 3/3 | none | - |
| test-reason.js | DETERMINISTIC | 3/3 | none | - |
| test-step4.js | DETERMINISTIC | 3/3 | none | - |
| test-step5.js | FAIL | 0/3 | 2 (undefined != PENDING_RETRY/CANCELLED) | Vendor quota max limits (2) reached when vendor1 wins concurrent race |
| test-step6.js | DETERMINISTIC | 3/3 | none | - |
| test-step7-regression.js | DETERMINISTIC | 3/3 | none | - |
| test-step7.js | DETERMINISTIC | 3/3 | none | - |
| test-step8.js | DETERMINISTIC | 3/3 | none | - |
| test-step9.js | DETERMINISTIC | 3/3 | none | - |
| test-transitions.js | DETERMINISTIC | 3/3 | none | - |
| test-unconfirmed.js | DETERMINISTIC | 3/3 | none | - |
