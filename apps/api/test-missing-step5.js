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

  console.log("Setting up data for additional tests...");
  const orgCookie = await login("organizer@eventcore.com");
  const vendor1Cookie = await login("vendor@eventcore.com");

  // Setup Event & Booths
  let res = await req("/organizer/events", {
    method: "POST", cookie: orgCookie,
    body: { name: "Step5 Missing Tests Event", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const eventId = res.json.id;

  // Create 3 booths
  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "T1", price: "100" }});
  const booth1 = res.json.id;
  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "T2", price: "100" }});
  const booth2 = res.json.id;
  res = await req(`/organizer/events/${eventId}/booths`, { method: "POST", cookie: orgCookie, body: { code: "T3", price: "100" }});
  const booth3 = res.json.id;

  console.log("\n=== 1. Test maxBoothsPerVendor ===");
  // Attempt to book 3 booths, which exceeds max 2
  let bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [booth1, booth2, booth3] } });
  console.log(`Status: ${bookRes.status}`);
  console.log(`Error: ${JSON.stringify(bookRes.json.error)}`);

  console.log("\n=== 2. Test PENDING_VERIFICATION after slip upload ===");
  // Book 1 booth
  bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [booth1] } });
  const bookingId = bookRes.json.id;
  
  // Upload slip
  await req(`/vendor/bookings/${bookingId}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip" } });
  
  // Query DB immediately
  const rawBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
  console.log(`Booking status in DB: ${rawBooking.status} (expected PENDING_VERIFICATION)`);
  
  console.log("\n=== 3. Test Ticket creation after approve ===");
  // Get the payment
  const paymentRes = await prisma.payment.findFirst({ where: { bookingId } });
  
  // Organizer approves
  await req(`/organizer/payments/${paymentRes.id}/verify`, { method: "POST", cookie: orgCookie, body: { status: "APPROVED" } });
  
  // Check ticket
  const ticket = await prisma.ticket.findUnique({ where: { bookingId } });
  console.log(`Ticket exists: ${!!ticket}`);
  console.log(`Ticket token: ${ticket?.token}`);
  
  console.log("\n=== 4. Confirm RAW DB row after First Reject ===");
  // Create another booking and payment
  bookRes = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [booth2] } });
  const rejectBookingId = bookRes.json.id;
  
  await req(`/vendor/bookings/${rejectBookingId}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip" } });
  const rejectPayment = await prisma.payment.findFirst({ where: { bookingId: rejectBookingId } });
  
  // First reject
  await req(`/organizer/payments/${rejectPayment.id}/verify`, { method: "POST", cookie: orgCookie, body: { status: "REJECTED", rejectionReason: "Blurry" } });
  
  // Query DB directly
  const rejectedBookingRow = await prisma.booking.findUnique({ where: { id: rejectBookingId } });
  console.log(`RAW DB status: ${rejectedBookingRow.status}`);
  console.log(`RAW DB holdExpiresAt: ${rejectedBookingRow.holdExpiresAt}`);
}

run();
