# EventCore Architecture Rules

- **Monorepo Layout**: `apps/api` (Express + TS + Prisma), `apps/web` (Next.js App Router + Tailwind), `packages/shared` (Zod schemas).
- **Hard Constraints**: Prisma 6.19.3 only. Never `migrate reset` or manually edit existing migrations. MySQL on 3307 with `eventcore_user`. Use `pnpm`. No real secrets in logs.
- **Layering (API)**: Routes -> Controllers (validate, auth) -> Services (business logic, DB). Controllers do not contain business logic.
- **Shared Validation**: Zod ONLY in `packages/shared`.
- **Frontend (Web)**: Next.js (App Router) and frontend-only (no Prisma, no Server Actions for mutations, no Auth.js). API port 4000; web port 3000.
- **Auth Model**: Cookie-based JWT (httpOnly, SameSite=Lax). Token contains only `userId`. On every request, `requireAuth` loads user from DB and checks current role/status. Cookie auth operates through a same-origin `/api` rewrite in Next.js config.
- **Ownership**: `verifyOrganizerEventOwnership` in services querying DB. Never trust client ID.
- **Money**: Decimal type.
- **Booth Holds**: Atomic updateMany inside $transaction (ascending id order, retry on P2034). Idempotent hold-release job.
- **Images**: Base64 max 2MB stored as LongText. Never selected in list queries.
- **Dates**: Stored UTC, shown as Asia/Bangkok.
- **System Safety**: Never run `taskkill /F /IM node.exe` system-wide. Always find the specific PID to kill.
- **Dependencies**: Never silently upgrade major versions (e.g. Next.js). Pin exact versions and ask before changing them.
- **Encoding**: Always use UTF-8 when writing or appending to config files (e.g. .gitignore). Do not use PowerShell's default echo/append which uses UTF-16.
