# EventCore MVP

EventCore is a comprehensive event and booth management platform built to handle complex, high-concurrency event bookings.

## Architecture Overview

This project is structured as a **Monorepo** using `pnpm` workspaces, dividing the system into specialized, decoupled components:

- **`apps/api`**: A robust, standalone Express.js backend. Handles all database interactions via Prisma, enforces business logic, manages the stateless JWT authentication system, and provides a strictly typed REST API.
- **`apps/web`**: A Next.js 15 frontend application. Entirely stateless and relies completely on the backend API for data, logic, and authentication. It renders the UI for Admins, Organizers, and Vendors, including complex interactive features like the Floorplan Canvas.
- **`packages/shared`**: A shared library containing Zod schemas, TypeScript types, and payload definitions. This ensures complete type safety across the network boundary, so both the frontend and backend agree on data structures exactly.

*Why separated?* This strict separation prevents accidental leakage of backend secrets to the frontend, ensures the API can be consumed by other clients (e.g., a future mobile app) without relying on Next.js Server Actions, and simplifies scaling the backend and frontend independently.

## Features by Role

### 👑 Admin
- **Global Overview**: Dashboard with system-wide statistics for users, events, and bookings.
- **Organizer Approval**: Review and approve/reject organizer applications to ensure quality.
- **Platform Management**: View all users across the system and monitor all events globally.

### 🎪 Organizer
- **Event Management**: Complete CRUD operations for events, including publishing/drafting.
- **Floorplan & Booths**: Interactive `react-konva` drag-and-drop map editor to design floorplans visually. Create zones and booths, set prices, and snap booths to a grid.
- **Booking Management**: Review vendor bookings, verify uploaded payment slips, and confirm or reject reservations.
- **Ticket Check-in**: Scan or manually check-in vendor tickets on event day with anti-reuse protection.

### 🛒 Vendor
- **Discovery**: View published events on the platform.
- **Interactive Booking**: View the live floorplan map, see which booths are available/booked (live color-coding), and select multiple available booths to book.
- **Concurrency-Safe Reservation**: 15-minute secure booking holds with atomic DB locking.
- **Payment & Ticketing**: Upload payment slips for verification and access QR code tickets once approved.

## How to Run Locally

### Prerequisites
- Node.js v18+
- Docker & Docker Compose
- `pnpm` installed (`npm install -g pnpm`)

### Setup Steps
1. **Start Database and Redis**:
   ```bash
   docker compose up -d
   ```
2. **Install Dependencies**:
   ```bash
   pnpm install
   ```
3. **Setup Environment**:
   Duplicate `.env.example` to `.env` in both `apps/api` and `apps/web`.
   *(Note: The current secrets in `.env.example` are strictly for local development. **They must be regenerated before any production deployment.** The backend will fail to start if `JWT_SECRET` is missing, preventing silent fallbacks.)*
4. **Initialize DB & Seed Data**:
   ```bash
   cd apps/api
   npx prisma migrate dev
   pnpm seed
   ```
5. **Run the Application**:
   Return to the root directory and start all services concurrently:
   ```bash
   pnpm dev
   ```
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:4000`

### Test Accounts (Dev Only)
- **Admin**: `admin@eventcore.com` / `password123`
- **Organizer**: `organizer@eventcore.com` / `password123` (Approved status)
- **Vendor**: `vendor@eventcore.com` / `password123`

---

## Known Limitations / Post-MVP Backlog

While fully functional for local demonstrations, the following architecture decisions were deferred during the MVP phase and must be addressed before production launch:

1. **Image Storage (Base64 -> S3/R2)**: Currently, cover images, floorplans, and payment slips are stored as 2MB Base64 strings directly in the database (`LongText`). This will bloat the DB rapidly. They must be migrated to a proper object storage service (AWS S3, Cloudflare R2).
2. **Email & Notification System**: The system currently lacks email triggers for important actions (e.g., booking confirmed, payment rejected, organizer approved).
3. **Pagination**: Admin and Organizer list views (users, events, bookings) fetch all records without limits. Cursor or offset pagination needs to be implemented on the API and UI.
4. **Rate Limiting**: The current `express-rate-limit` relies on an in-memory store. In a multi-instance production environment, this will cause inconsistent rate limiting. It should be migrated to a `RedisStore`.
5. **No Password Reset**: The MVP lacks a "Forgot Password" flow.
6. **No Real Payment Gateway**: Payment verification relies on manual slip uploads and organizer review, rather than Stripe/Omise integration.
