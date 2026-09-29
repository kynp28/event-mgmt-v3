const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const login = async (email, password = "password123") => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    const cookieHeader = r.headers.getSetCookie();
    return { status: r.status, json, cookie: (cookieHeader && cookieHeader.length > 0) ? cookieHeader[0].split(";")[0] : null };
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

  const adminCookie = (await login("admin@eventcore.com")).cookie;

  // Setup organizer
  const pw = await require('bcryptjs').hash('password123', 10);
  const email = "org-test-reason@test.com";
  let org = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: pw, role: 'ORGANIZER', organizerProfile: { create: { companyName: 'Reason Test', status: 'PENDING' } } }
  });
  const profileId = (await prisma.organizerProfile.findUnique({ where: { userId: org.id } })).id;

  console.log("=== Reject with Reason A ===");
  await req(`/admin/organizers/${profileId}/verify`, { method: "POST", cookie: adminCookie, body: { status: "REJECTED", reason: "Reason A" } });
  
  let loginRes = await login(email);
  console.log(`Login Error Msg: ${loginRes.json.error?.message}`);

  console.log("\n=== Admin Approves ===");
  await req(`/admin/organizers/${profileId}/verify`, { method: "POST", cookie: adminCookie, body: { status: "APPROVED" } });

  loginRes = await login(email);
  console.log(`Login Status: ${loginRes.status} (should be 200)`);

  console.log("\n=== Admin Rejects with Reason B ===");
  await req(`/admin/organizers/${profileId}/verify`, { method: "POST", cookie: adminCookie, body: { status: "REJECTED", reason: "Reason B" } });

  loginRes = await login(email);
  console.log(`Login Error Msg: ${loginRes.json.error?.message}`);
}
run();
