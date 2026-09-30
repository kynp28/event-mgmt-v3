# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy` (or `baseline:compare` to verify against reference logs).
**Scan Expected:** `pnpm --filter api baseline:scan`

The runner performs the following steps for each script:
1. Drops all tables in the isolated legacy database (`eventcore_test_legacy`) using the project's Prisma client with foreign key checks disabled.
2. Runs `npx prisma migrate deploy` and `npm run db:seed` against the legacy database. **Note: `organizer2@eventcore.com` and `org2@eventcore.com` (both APPROVED with profiles) were added to the seed to provide required fixtures.**
3. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
4. Starts the API server (without watch mode) against the isolated legacy database and polls `/api/health` until it returns 200.
5. Runs the legacy script and normalizes its output (UUIDs to `<UUID>`, timestamps/dates to `<TS>`, durations to `<MS>`, JWTs to `<TOKEN>`).
6. Stops the server process tree cleanly and verifies port 4000 is free.

**Important Rule:** Never run Vitest and the runner at the same time. The runner uses the isolated legacy database (`eventcore_test_legacy`) while Vitest uses `eventcore_test`. Both could conflict on ports if run simultaneously.

**Explicit Note on Login Rate Limiting:**
The login endpoint imposes a strict rate limit (`windowMs: 15 * 60 * 1000, max: 10`). This requires a server restart between scripts when running them by hand. If run consecutively without a restart, the scripts rapidly exhaust the 10-login quota, resulting in 429 Too Many Requests, which previously caused misleading crashes (`TypeError: Cannot read properties of undefined (reading 'split')`).

## Legacy Scripts Status
| Script | Classification | Passed | Known Mismatches | Cause |
| --- | --- | --- | --- | --- |
| test-auth.js | DETERMINISTIC | 3/3 | none | - |
| test-concurrency.js | DETERMINISTIC | 3/3 | none | - |
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
