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

  console.log("Setting up data for Ticket tests...");
  const orgCookie = await login("organizer@eventcore.com");
  const otherOrgCookie = await login("admin@eventcore.com"); // admin can act as another org or we create one
  const vendor1Cookie = await login("vendor@eventcore.com");
  const vendor2Cookie = await login("vendor2@eventcore.com");

  // Setup Event & Booths
  let res = await req("/organizer/events", {
    method: "POST", cookie: orgCookie,
    body: { name: "Ticket Test Event", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const eventId = res.json.id;

  // Create booths
  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "TK1", price: "100" }});
  const booth1 = res.json.id;
  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "TK2", price: "100" }});
  const booth2 = res.json.id;

  // Book Booth 1 and Approve
  let bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [booth1] } });
  const booking1Id = bookRes.json.id;
  await req(`/vendor/bookings/${booking1Id}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip" } });
  const payment1 = await prisma.payment.findFirst({ where: { bookingId: booking1Id } });
  await req(`/organizer/payments/${payment1.id}/verify`, { method: "POST", cookie: orgCookie, body: { status: "APPROVED" } });

  // Book Booth 2 (leave it PAYMENT_PENDING)
  bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [booth2] } });
  const booking2Id = bookRes.json.id;

  console.log("\n=== 1. Vendor views own confirmed ticket ===");
  res = await req(`/vendor/bookings/${booking1Id}/ticket`, { cookie: vendor1Cookie });
  console.log(`Status: ${res.status}`);
  console.log(`Has token: ${!!res.json.ticket?.token}`);

  const validToken = res.json.ticket.token;

  console.log("\n=== 2. Vendor tries to view another vendor's ticket ===");
  res = await req(`/vendor/bookings/${booking1Id}/ticket`, { cookie: vendor2Cookie });
  console.log(`Status: ${res.status} (expected 404 or 403)`);

  console.log("\n=== 3. Organizer checks in on UNCONFIRMED booking (should not have ticket, or fail) ===");
  const b2Ticket = await prisma.ticket.findUnique({ where: { bookingId: booking2Id } });
  console.log(`Unconfirmed booking has ticket? ${!!b2Ticket}`);

  console.log("\n=== 4. Check-in concurrency test (atomic updateMany) ===");
  const [ci1, ci2] = await Promise.all([
    req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: orgCookie, body: { token: validToken } }),
    req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: orgCookie, body: { token: validToken } })
  ]);
  console.log(`Request 1 status: ${ci1.status}`);
  console.log(`Request 2 status: ${ci2.status}`);
  if (ci1.status === 200 && ci2.status === 409 || ci1.status === 409 && ci2.status === 200) {
    console.log("Concurrency test: PASS");
    if (ci1.status === 409) console.log("409 msg:", ci1.json.error.message);
    if (ci2.status === 409) console.log("409 msg:", ci2.json.error.message);
  } else {
    console.log("Concurrency test: FAIL");
  }

  console.log("\n=== 5. Organizer checks in SAME token again ===");
  res = await req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: orgCookie, body: { token: validToken } });
  console.log(`Status: ${res.status} (expected 409)`);
  console.log(`Error message: ${res.json.error.message}`);

  console.log("\n=== 6. Organizer from DIFFERENT event tries to check in ===");
  // Create second organizer
  const org2pw = await require('bcryptjs').hash('password123', 10);
  let org2;
  try {
    org2 = await prisma.user.create({ data: { email: 'org2@eventcore.com', password: org2pw, role: 'ORGANIZER' } });
  } catch(e) {
    org2 = await prisma.user.findUnique({ where: { email: 'org2@eventcore.com' }});
  }
  const org2Cookie = await login(org2.email);
  
  res = await req(`/organizer/events/${eventId}/checkin`, { method: "POST", cookie: org2Cookie, body: { token: validToken } });
  console.log(`Status: ${res.status} (expected 403/404)`);
}

run();
