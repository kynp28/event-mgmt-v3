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
  const vendor2Cookie = await login("vendor2@eventcore.com");

  let res = await req("/organizer/events", {
    method: "POST", cookie: orgCookie,
    body: { name: "Concurrency Re-Test", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const eventId = res.json.id;

  res = await req(`/organizer/events/${eventId}/booths`, {
    method: "POST", cookie: orgCookie, body: { code: "CONC_BOOTH_2", price: "100" }
  });
  const boothId = res.json.id;
  
  console.log("\n=== Concurrency Test (Prisma.join Rewrite) ===");
  const [res1, res2] = await Promise.all([
    req("/vendor/bookings", { method: "POST", cookie: vendor1Cookie, body: { eventId, boothIds: [boothId] } }),
    req("/vendor/bookings", { method: "POST", cookie: vendor2Cookie, body: { eventId, boothIds: [boothId] } })
  ]);
  
  console.log(`V1 Status: ${res1.status}`);
  console.log(`V1 Body:`, res1.json);
  console.log(`V2 Status: ${res2.status}`);
  console.log(`V2 Body:`, res2.json);
}

run();
