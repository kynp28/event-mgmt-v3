# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy` (or `baseline:compare` to verify against reference logs).

The runner performs the following steps for each script:
1. Drops all tables in `eventcore_test` using the project's Prisma client with foreign key checks disabled.
2. Runs `npx prisma migrate deploy`.
3. Runs `npm run db:seed`. **Note: `organizer2@eventcore.com` and `org2@eventcore.com` (both APPROVED with profiles) were added to the seed to provide required fixtures.**
4. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
5. Starts the API server (without watch mode) against `eventcore_test` and polls `/api/health` until it returns 200.
6. Runs the legacy script and normalizes its output.
7. Stops the server process tree cleanly and verifies port 4000 is free.

**Explicit Note on Login Rate Limiting:**
The login endpoint in `apps/api/src/index.ts` (line 26) imposes a strict rate limit (`windowMs: 15 * 60 * 1000, max: 10`). This requires a server restart between scripts when running them by hand. If run consecutively without a restart, the scripts will rapidly exhaust the 10-login quota, resulting in 429 Too Many Requests, which previously caused misleading crashes (`TypeError: Cannot read properties of undefined (reading 'split')`).

**Note on Determinism:**
"PASS" means the script exited with code 0. However, for DETERMINISTIC scripts, reference-log comparison is the real check to ensure that output logic assertions (`FAIL`/`expected XYZ`) remain unchanged.

## Legacy Scripts Status
| Script | Classification | Passed | Self-checking | Cause |
| --- | --- | --- | --- | --- |
| test-auth.js | DETERMINISTIC | 3/3 | prints only | - |
| test-concurrency.js | DETERMINISTIC | 3/3 | prints only | - |
| test-endpoint-rules.js | FAIL | 0/3 | prints only | Foreign key constraint (organizerId) during Event creation |
| test-lists.js | DETERMINISTIC | 3/3 | prints only | - |
| test-missing-step5.js | FLAKY | 3/3 | prints only | Output varies because ticket tokens (UUIDs) and raw dates are not normalized |
| test-reason.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step4.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step5.js | FAIL | 0/3 | prints only | Vendor quota max limits (2) reached when vendor1 wins concurrent race |
| test-step6.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step7-regression.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step7.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step8.js | DETERMINISTIC | 3/3 | prints only | - |
| test-step9.js | DETERMINISTIC | 3/3 | prints only | - |
| test-transitions.js | DETERMINISTIC | 3/3 | prints only | - |
| test-unconfirmed.js | DETERMINISTIC | 3/3 | prints only | - |
