# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy` (or `baseline:compare` to verify against reference logs).
**Scan Expected:** `pnpm --filter api baseline:scan` (use `--include-evidence` to see output for FLAKY/FAIL scripts).
**Update Reference:** `pnpm --filter api baseline:update-reference` (explicit, reviewed via git diff before commit).

The runner performs the following steps for each script:
1. Validates the database is exactly `eventcore_test_legacy` and checks that the script name is valid. It uses strict checking logic and parses `.env.test` explicitly.
2. Drops all tables using a pinned Prisma `$transaction` connection (`maxWait: 10000`, `timeout: 60000`) checking `DATABASE()` to be precisely `eventcore_test_legacy`. All tables, including `_prisma_migrations`, are dynamically dropped. Foreign key checks are restored in a `finally` block.
3. Runs `npx prisma migrate deploy` and `npx tsx prisma/seed.ts` against the legacy database.
4. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
5. Starts the API server and polls `/api/health` until it returns 200 (timeout configurable via `BASELINE_HEALTH_TIMEOUT_MS`, default 60000). The server must be completely healthy. If unhealthy, the script is marked `NOT RUNNABLE`.
6. Runs the legacy script and normalizes its output. Script execution is bounded by `BASELINE_SCRIPT_TIMEOUT_MS` (default 120000). If it exceeds this, the script is classified as `TIMEOUT`.
7. Stops the server process tree cleanly in a `finally` block and verifies port 4000 is free using precise `netstat` regex matching (`:4000\b`). Cleanup of file descriptors, temporary directories, and DB connections is guaranteed to run on every exit path.

**Important Rule:** The runner and Vitest must be kept strictly sequential. The runner uses the isolated legacy database (`eventcore_test_legacy`) while Vitest uses `eventcore_test`.

## Gate Semantics
- **Allowlist (`docs/baseline-known-failures.json`)**: Tracks scripts that fail deterministically due to known bugs. Failures here do not fail the CI gate (they print "KNOWN FAIL (allowlisted)"). If an allowlisted script magically passes (exit 0), the gate prints a notice but does not fail.
- **Exit Code Rules (`baseline:compare`)**: The process exits non-zero if a script is `NOT RUNNABLE`, `TIMEOUT`, mismatched, or if a `FAIL`/`FLAKY` script is not on the allowlist. Mismatch diffs use a temporary directory in `%TEMP%` that is strictly cleaned up on all exits.
- **Update Refusal**: `--update-reference` strictly refuses to write any references if: requested runs are < 3, any script is `NOT RUNNABLE` or `TIMEOUT`, or any non-allowlisted script is `FLAKY`, or if output mismatches across runs for `DETERMINISTIC` scripts.
- **Scan Scope**: `baseline:scan` only checks logs directly inside `docs/baseline-logs`.

## Retracted Root Causes
- Original `baseline-runner.mjs` execution hang: NOT TESTED (defensive hardening was added).
- API terminal window race causing issues: NOT KNOWN.

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
| test-step5.js | FAIL | 0/5 | 2 (undefined != PENDING_RETRY/CANCELLED) | Vendor quota max limits (2) reached when vendor1 wins concurrent race |
| test-step6.js | DETERMINISTIC | 3/3 | none | - |
| test-step7-regression.js | DETERMINISTIC | 3/3 | none | - |
| test-step7.js | DETERMINISTIC | 3/3 | none | - |
| test-step8.js | DETERMINISTIC | 3/3 | none | - |
| test-step9.js | DETERMINISTIC | 3/3 | none | - |
| test-transitions.js | DETERMINISTIC | 3/3 | none | - |
| test-unconfirmed.js | DETERMINISTIC | 3/3 | none | - |
