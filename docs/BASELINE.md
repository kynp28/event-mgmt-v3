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
3. Runs `npx prisma migrate deploy` and `npx tsx prisma/seed.ts` against the legacy database. **Note: `organizer2@eventcore.com` and `org2@eventcore.com` (both APPROVED with profiles) were added to the seed to provide required fixtures.**
4. Generates a random `JOBS_SECRET` and provides it to both the API server and the test script.
5. Starts the API server and polls `/api/health` until it returns 200 (timeout configurable via `BASELINE_HEALTH_TIMEOUT_MS`, default 60000). The server must be completely healthy. If unhealthy, the script is marked `NOT RUNNABLE`.
6. Runs the legacy script and normalizes its output. Script execution is bounded by `BASELINE_SCRIPT_TIMEOUT_MS` (default 120000). If it exceeds this, the script is classified as `TIMEOUT`.
7. Stops the server process tree cleanly. Cleanup of file descriptors, server shutdown, temporary directories, and DB connections is guaranteed to run on every path through the per-run section. Port 4000 is verified free using precise `netstat` regex matching (`:4000\b`).

**Important Rule:** The runner and Vitest must be kept strictly sequential. The runner uses the isolated legacy database (`eventcore_test_legacy`) while Vitest uses `eventcore_test`. Although they use different databases, keeping them sequential ensures that timing-sensitive concurrency tests stay reliable and ports do not conflict.

**Explicit Note on Login Rate Limiting:**
The login endpoint imposes a strict rate limit (`windowMs: 15 * 60 * 1000, max: 10`). This requires a server restart between scripts when running them by hand. If run consecutively without a restart, the scripts rapidly exhaust the 10-login quota, resulting in 429 Too Many Requests, which previously caused misleading crashes (`TypeError: Cannot read properties of undefined (reading 'split')`).

## Gate Semantics
- **Allowlist (`docs/baseline-known-failures.json`)**: Tracks scripts that fail deterministically due to known bugs. Failures here do not fail the CI gate (they print "KNOWN FAIL (allowlisted)"). If an allowlisted script magically passes (exit 0), the gate prints a notice but does not fail.
- **Exit Code Rules (`baseline:compare`)**: The process exits non-zero if a script is `NOT RUNNABLE`, `TIMEOUT`, mismatched, or if a `FAIL`/`FLAKY` script is not on the allowlist. Mismatch diffs use a temporary directory in `%TEMP%` that is strictly cleaned up on all exits.
- **Update Refusal**: `--update-reference` strictly refuses to write any references if: requested runs are < 3, any script is `NOT RUNNABLE` or `TIMEOUT`, or any non-allowlisted script is `FLAKY`, or if output mismatches across runs for `DETERMINISTIC` scripts.
- **Allowlisted Updates**: For an allowlisted script, `--update-reference` must never write or delete a root reference log, and must never delete its evidence/*.fail.log; if it is not FAIL in that update, print Notice: allowlisted `<script>` was `<classification>`; references untouched and write nothing for it. Non-allowlisted scripts behave normally.
- **Scan Scope**: `baseline:scan` only checks logs directly inside `docs/baseline-logs` (which correspond to `DETERMINISTIC` scripts). It ignores logs in `evidence/` unless `--include-evidence` is passed. Scanning requires `CRLF` normalized to `LF` before matching and exits 1 if 0 expected-lines rows are found.
- **RACE-DEPENDENT**: Scripts whose output varies purely based on race conditions (e.g. concurrent HTTP requests) without any normalization gaps. They are excluded from `baseline:compare` checks. Their race outcomes are recorded in `evidence/`.

**Classification Authority:** A classification is authoritative ONLY when it comes from a 3-run `update-reference`. A 1-run `compare` (`--runs 1`, default) can only detect mismatches against the reference, not flakiness.

**Known limitations:** FAIL evidence logs are raw output and churn between runs; `race-outcomes.md` count comes from the earlier 10-run experiment (commit `38ab5b6`).

## Feature Acceptance Checklist
To accept a feature or fix, the following sequence must pass strictly sequentially:
1. `git status --porcelain` (Expected: empty)
2. `pnpm --filter api test` (Expected: all tests pass (update the expected count when tests are added))
3. `pnpm --filter api baseline:compare` (Expected: exit code 0)
4. `pnpm --filter api test` (Expected: all tests pass (update the expected count when tests are added), verifying DB state is preserved)
5. `pnpm --filter api baseline:scan` (Expected: exit code 0 and no FAIL rows in the printed table)
6. `pnpm --filter api exec tsc --noEmit` (Expected: exit code 0)

## Open questions
- the original runner hang is NOT TESTED (the `res.resume()`, `unref()`, fd closing and script-timeout changes are defensive hardening);
- the Windows Terminal window running `cmd.exe /K npx.cmd tsx src\index.ts` is NOT KNOWN.

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
| test-step5.js | FAIL (allowlisted) | 0/5 | 2 (undefined != PENDING_RETRY/CANCELLED) | Vendor quota max limits (2) reached when vendor1 wins concurrent race |
| test-step6.js | DETERMINISTIC | 3/3 | none | - |
| test-step7-regression.js | DETERMINISTIC | 3/3 | none | - |
| test-step7.js | DETERMINISTIC | 3/3 | none | - |
| test-step8.js | DETERMINISTIC | 3/3 | none | - |
| test-step9.js | DETERMINISTIC | 3/3 | none | - |
| test-transitions.js | DETERMINISTIC | 3/3 | none | - |
| test-unconfirmed.js | DETERMINISTIC | 3/3 | none | - |

test-step5.js is allowlisted; observed FAIL in standalone 5/5 runs and 3/3 update runs, but exit 0 in two later full compare passes; classification is unstable and is not evidence either way.
Note: `durationMs` covers the whole per-script pipeline (reset, migrate, seed, server start, script).
