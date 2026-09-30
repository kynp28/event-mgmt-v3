# Legacy Test Baseline

This document records the exact state of the `test-*.js` regression net.

## Protocol
The legacy baseline is now fully reproducible using the automated runner script.
**Command:** `pnpm --filter api baseline:legacy` (or `baseline:compare` to verify against reference logs).
**Scan Expected:** `pnpm --filter api baseline:scan` (use `--include-evidence` to see output for FLAKY/FAIL scripts).

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

## Gate Semantics
- **Allowlist (`docs/baseline-known-failures.json`)**: Tracks scripts that fail deterministically due to known bugs. Failures here do not fail the CI gate (they print "KNOWN FAIL (allowlisted)"). If an allowlisted script magically passes (exit 0), the gate prints a notice but does not fail.
- **Exit Code Rules (`baseline:compare`)**: The process exits non-zero if and only if a `DETERMINISTIC` script mismatches its reference log/crashes, or a script *not* in the allowlist fails.
- **Scan Scope**: `baseline:scan` only checks logs directly inside `docs/baseline-logs` (which correspond to `DETERMINISTIC` scripts). It ignores logs in `evidence/` unless `--include-evidence` is passed.
- **RACE-DEPENDENT**: Scripts whose output varies purely based on race conditions (e.g. concurrent HTTP requests) without any normalization gaps. They are excluded from `baseline:compare` checks. Their logs are moved to `evidence/`.

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
