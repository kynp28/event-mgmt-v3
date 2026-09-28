# EventCore Architecture Rules

- **Monorepo Layout**: `apps/api` (Express + TS + Prisma), `apps/web` (Vite + React), `packages/shared` (Zod schemas).
- **Hard Constraints**: Prisma 6.19.3 only. Never `migrate reset` or manually edit existing migrations. MySQL on 3307 with `eventcore_user`. Use `pnpm`. No real secrets in logs.
- **Layering (API)**: Routes -> Controllers (validate, auth) -> Services (business logic, DB). Controllers do not contain business logic.
- **Shared Validation**: Zod ONLY in `packages/shared`.
- **Auth Model**: Cookie-based JWT (httpOnly, SameSite=Lax). Token contains only `userId`. On every request, `requireAuth` loads user from DB and checks current role/status.
- **Ownership**: `verifyOrganizerEventOwnership` in services querying DB. Never trust client ID.
- **Money**: Decimal type.
- **Booth Holds**: Atomic updateMany inside $transaction (ascending id order, retry on P2034). Idempotent hold-release job.
- **Images**: Base64 max 2MB stored as LongText. Never selected in list queries.
- **Dates**: Stored UTC, shown as Asia/Bangkok.
