# EventCore V3 - MVP

EventCore is a platform for organizers to manage events and floorplans, and for vendors to book booths interactively.

## MVP Features
- **Authentication**: Role-based access control (ADMIN, ORGANIZER, VENDOR).
- **Event & Zone Management**: Organizers can create events, define zones, and upload cover images.
- **Interactive Floorplan**: A visual drag-and-drop editor for organizers to upload a venue map and arrange booths (snap-to-grid, resize, rotate).
- **Vendor Booking**: Vendors can view a read-only interactive map, select available booths (up to the event's max limit), and checkout.
- **Payment & Verification**: Vendors upload payment slips; organizers approve/reject them.
- **Check-in**: Organizers scan tickets (QR codes) for vendor entry.
- **Admin Dashboard**: Approving organizers, system overview stats.

## Known Limitations & Post-MVP Backlog
The following items are deferred to post-MVP for a production-ready release:

1. **Cloud File Storage (e.g., AWS S3 / Cloudflare R2)**
   - **Current State**: Images (cover images, floorplans, payment slips) are stored as Base64 strings directly in the database (`LongText`).
   - **Impact**: Bloats the database and increases payload size, slowing down queries (even with `select` exclusions).
   - **Action**: Migrate to object storage and store pre-signed URLs in the database.

2. **Email Notifications & Webhooks**
   - **Current State**: System relies entirely on users logging in to check statuses (e.g., booking approval, organizer verification).
   - **Impact**: Poor UX for vendors who don't know when their payment is approved or rejected.
   - **Action**: Integrate a transactional email service (e.g., Resend, SendGrid) to send lifecycle notifications.

3. **Data Pagination & Virtualization**
   - **Current State**: API endpoints (`findMany`) and frontend tables/canvas fetch and render all records at once without limits.
   - **Impact**: Performance bottleneck for events with 1,000+ booths or when the admin views all users.
   - **Action**: Implement offset/cursor pagination on the backend, and virtualization (or culling) for the `react-konva` canvas.

4. **Production Rate Limits & Secrets**
   - **Current State**: `JWT_SECRET` and `AUTH_SECRET` use fallback dev values if `.env` is missing. Rate limits use an in-memory store.
   - **Impact**: Unsafe for production. In-memory rate limiting fails across multiple server instances.
   - **Action**: Enforce strict secrets via environment variables in production. Move rate limit store to Redis.
