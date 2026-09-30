# Test Baseline

## Environment
- **Database:** `eventcore_test`
- **Protocol:**
  1. Reset database using Docker `mysql` to DROP and CREATE `eventcore_test`.
  2. Run `npx prisma migrate deploy`.
  3. Run `npm run db:seed` to seed users and a sample `PUBLISHED` event (using `tsx prisma/seed.ts`).
  4. Start API server against `eventcore_test` using `npm run dev` and wait for `/api/health` to return 200.
  5. Run script.
  6. Stop API server.
- **Base URL:** `http://localhost:4000`

| Script | Result | Prerequisites | First Failing Line |
| --- | --- | --- | --- |
| test-auth.js | PASS | Running API on localhost:4000, seeded users | - |
| test-concurrency.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-endpoint-rules.js | NOT RUNNABLE | missing prerequisite hardcoded organizer ID cmul5ijq30001vcps72o3jmyz in database | PrismaClientKnownRequestError: Invalid `prisma.event.create()` invocation in C:\Users\Lenovo\Desktop\event-mgmt-v3\apps\api\test-endpoint-rules.js:28:37 |
| test-lists.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-missing-step5.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-reason.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step4.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step5.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step6.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step7-regression.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step7.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step8.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-step9.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| test-transitions.js | PASS | Running API on localhost:4000, seeded users | - |
| test-unconfirmed.js | PASS | Running API on localhost:4000, seeded users & PUBLISHED event | - |
| Vitest Suite | PASS (isolated) / FAIL (dirty) | Fresh DB, `npm run test` sets `NODE_ENV=test` | PrismaClientKnownRequestError: Invalid `db.user.deleteMany()` invocation (Foreign key constraint violated on `userId`) |


## Vitest Suite Notes
**Root Cause of Dirty Run Failure:**
When the Vitest suite is run on a database that has just been reset (clean), it passes completely (12/12).
When run on a database that the legacy scripts have previously used (dirty), it fails during `clearDb` teardown. The root cause is that `clearDb` in `tests/helpers.ts` deletes from `User` but does not first delete from `AuditLog`. Legacy scripts (like `test-transitions.js`) create `AuditLog` records that depend on `User`, leading to a foreign key constraint violation (บนฟิลด์ `userId`) เมื่อ `clearDb` พยายามลบ `User` ออก.
