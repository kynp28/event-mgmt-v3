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

  console.log("Setting up data...");
  const orgCookie = await login("organizer@eventcore.com");
  const vendor1Cookie = await login("vendor@eventcore.com");
  const vendor2Cookie = await login("vendor2@eventcore.com"); // We need to create this

  // Setup Event & Booth
  let res = await req("/organizer/events", {
    method: "POST", cookie: orgCookie,
    body: { name: "Booking Test Event", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const eventId = res.json.id;

  res = await req(`/organizer/events/${eventId}/booths`, {
    method: "POST", cookie: orgCookie, body: { code: "TEST_CONCURRENCY", price: "100" }
  });
  const concurrentBoothId = res.json.id;
  
  res = await req(`/organizer/events/${eventId}/booths`, {
    method: "POST", cookie: orgCookie, body: { code: "TEST_LIFECYCLE", price: "200" }
  });
  const lifecycleBoothId = res.json.id;
  
  res = await req(`/organizer/events/${eventId}/booths`, {
    method: "POST", cookie: orgCookie, body: { code: "TEST_REJECT", price: "300" }
  });
  const rejectBoothId = res.json.id;
  
  console.log("=== 1. Concurrency Test ===");
  console.log("Firing two simultaneous bookings for the same booth...");
  
  const [res1, res2] = await Promise.all([
    req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [concurrentBoothId] } }),
    req("/vendor/bookings", { method: "POST", cookie: vendor2Cookie, body: { eventId, boothIds: [concurrentBoothId] } })
  ]);
  
  console.log(`V1 Status: ${res1.status}`);
  console.log(`V2 Status: ${res2.status}`);
  const passConcurrency = (res1.status === 201 && res2.status === 409) || (res1.status === 409 && res2.status === 201);
  console.log(`Concurrency test: ${passConcurrency ? "PASS" : "FAIL"}`);

  console.log("\n=== 2. Lifecycle Test (Success path) ===");
  res = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [lifecycleBoothId] } });
  const lifecycleBookingId = res.json.id;
  console.log(`Booking created: ${lifecycleBookingId}`);
  
  res = await req(`/vendor/bookings/${lifecycleBookingId}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip" } });
  const paymentId = res.json.id;
  console.log(`Payment uploaded: ${paymentId}`);
  
  res = await req(`/organizer/payments/${paymentId}/verify`, { method: "POST", cookie: orgCookie, body: { status: "APPROVED" } });
  console.log(`Payment verified: ${res.json.status}`);
  
  const verifiedBooth = await prisma.booth.findUnique({ where: { id: lifecycleBoothId } });
  console.log(`Booth status after approve: ${verifiedBooth.status} (expected BOOKED)`);
  
  console.log("\n=== 3. Reject Twice cancels Test ===");
  res = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [rejectBoothId] } });
  const rejectBookingId = res.json.id;
  
  res = await req(`/vendor/bookings/${rejectBookingId}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip" } });
  const rejectPaymentId1 = res.json.id;
  
  res = await req(`/organizer/payments/${rejectPaymentId1}/verify`, { method: "POST", cookie: orgCookie, body: { status: "REJECTED", rejectionReason: "Blurry" } });
  console.log(`First reject result: ${res.json.result} (expected PENDING_RETRY)`);
  
  res = await req(`/vendor/bookings/${rejectBookingId}/payments`, { method: "POST", cookie: vendor1Cookie, body: { slipImage: "data:image/png;base64,fake_slip2" } });
  const rejectPaymentId2 = res.json.id;
  
  res = await req(`/organizer/payments/${rejectPaymentId2}/verify`, { method: "POST", cookie: orgCookie, body: { status: "REJECTED", rejectionReason: "Still blurry" } });
  console.log(`Second reject result: ${res.json.result} (expected CANCELLED)`);
  
  const rejectedBooth = await prisma.booth.findUnique({ where: { id: rejectBoothId } });
  console.log(`Booth status after double reject: ${rejectedBooth.status} (expected AVAILABLE)`);

  console.log("\n=== 4. Lifecycle Test (Expiration Job) ===");
  res = await req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [rejectBoothId] } });
  const expireBookingId = res.json.id;
  
  // Force holdExpiresAt to be in the past
  await prisma.booking.update({ where: { id: expireBookingId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
  
  res = await req(`/jobs/release-expired-bookings`, { method: "POST" });
  console.log(`Job released count: ${res.json.releasedCount}`);
  
  const expiredBooth = await prisma.booth.findUnique({ where: { id: rejectBoothId } });
  console.log(`Booth status after job: ${expiredBooth.status} (expected AVAILABLE)`);
}

run();
