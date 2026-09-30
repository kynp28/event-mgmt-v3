# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy`

The runner performs the following steps for each script:
1. Drops all tables in `eventcore_test` using the project's Prisma client with foreign key checks disabled.
2. Runs `npx prisma migrate deploy`.
3. Runs `npm run db:seed` (using `tsx prisma/seed.ts`). **Note: `vendor2@eventcore.com` was added to the seed to make legacy scripts pass.**
4. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
5. Starts the API server (without watch mode) against `eventcore_test` and polls `/api/health` until it returns 200.
6. Runs the legacy script and captures the complete `stdout` and `stderr` to `.baseline-logs/`.
7. Stops the server process tree cleanly and verifies port 4000 is free.

**Explicit Note on Previous Results:**
The earlier `PASS` entries for `test-concurrency.js`, `test-step4.js`, `test-step5.js`, and `test-step6.js` recorded prior to this runner could not be reproduced under the stated protocol before the seed change. The root cause is that all legacy scripts run against an API endpoint with a strict rate limiter (`windowMs: 15m, max: 10 requests`). When multiple scripts were previously run sequentially without server restarts, the rate limiter would reject subsequent logins with `429 Too Many Requests`. The `login` helper would then fail to find a `Set-Cookie` header, throwing `TypeError: Cannot read properties of undefined (reading 'split')`. Furthermore, `vendor2@eventcore.com` and `organizer2@eventcore.com` were not provided in the original seed, which naturally caused `401 Unauthorized` responses and identical crashes even without the rate limit.

## Legacy Scripts Status
| Script | Result | Self-checking | Prerequisites | First Failing Line |
| --- | --- | --- | --- | --- |
| test-auth.js | PASS | prints only | - | - |
| test-concurrency.js | PASS | prints only | `organizer@eventcore.com`, `vendor@eventcore.com`, `vendor2@eventcore.com` | - |
| test-endpoint-rules.js | FAIL | prints only | hard-coded organizer ID | `Error: Not Found` |
| test-lists.js | PASS | prints only | - | - |
| test-missing-step5.js | PASS | prints only | - | - |
| test-reason.js | PASS | prints only | - | - |
| test-step4.js | FAIL | prints only | `organizer@eventcore.com` (provided), `organizer2@eventcore.com` (NOT provided) | `TypeError: Cannot read properties of undefined (reading 'split')` |
| test-step5.js | PASS | prints only | `organizer@eventcore.com`, `vendor@eventcore.com`, `vendor2@eventcore.com` | - |
| test-step6.js | PASS | prints only | `organizer@eventcore.com`, `admin@eventcore.com`, `vendor@eventcore.com`, `vendor2@eventcore.com`, dynamically created org2 | - |
| test-step7-regression.js | PASS | prints only | - | - |
| test-step7.js | PASS | prints only | - | - |
| test-step8.js | PASS | prints only | - | - |
| test-step9.js | PASS | prints only | - | - |
| test-transitions.js | PASS | prints only | - | - |
| test-unconfirmed.js | PASS | prints only | - | - |

## Vitest Suite Status
**Status:** PASS (16/16)
The Vitest suite passes completely on both a clean database and a legacy-dirtied database.
