const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    return r.headers.getSetCookie()[0].split(";")[0];
  };

  const req = async (path, opts) => {
    const headers = { "Content-Type": "application/json" };
    if (opts.cookie) headers["Cookie"] = opts.cookie;
    const r = await fetch(`http://localhost:4000/api${path}`, {
      method: opts.method || "GET", headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: r.status, json };
  };

  const orgCookie = await login("organizer@eventcore.com");
  const vendor1Cookie = await login("vendor@eventcore.com");

  // Setup Event & Booth
  let res = await req("/organizer/events", {
    method: "POST", cookie: orgCookie,
    body: { name: "Fake Ticket Test", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02" }
  });
  const eventId = res.json.id;

  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "FK1", price: "100" }});
  const boothId = res.json.id;

  // Book Booth (status: PAYMENT_PENDING)
  let bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [boothId] } });
  const booking = bookRes.json;

  // Simulate edge case: manually inject a Ticket row for this UNCONFIRMED booking directly in DB
  const fakeToken = "edge-case-token-12345";
  await prisma.ticket.create({
    data: {
      token: fakeToken,
      bookingId: booking.id,
      eventId: eventId,
      userId: booking.vendorId
    }
  });

  console.log("\n=== 1. Test checkIn with fake token (TICKET_NOT_FOUND) ===");
  let ciRes = await req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: orgCookie, body: { token: "this-does-not-exist" } });
  console.log(`Status: ${ciRes.status} (expected 404)`);
  console.log(`Error: ${ciRes.json.error?.code}`);

  console.log("\n=== 2. Test checkIn with real token but booking is PAYMENT_PENDING (INVALID_TICKET) ===");
  ciRes = await req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: orgCookie, body: { token: fakeToken } });
  console.log(`Status: ${ciRes.status} (expected 400)`);
  console.log(`Error: ${ciRes.json.error?.code}`);
}

run();
