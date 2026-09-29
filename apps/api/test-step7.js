const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
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

  console.log("Setting up data for Admin tests...");
  const adminRes = await login("admin@eventcore.com");
  const adminCookie = adminRes.cookie;
  const vendorRes = await login("vendor@eventcore.com");
  const vendorCookie = vendorRes.cookie;

  // Create two pending organizers directly via DB for testing
  const pw = await require('bcryptjs').hash('password123', 10);
  let orgApprove = await prisma.user.upsert({
    where: { email: 'org-approve@test.com' },
    update: {},
    create: { email: 'org-approve@test.com', password: pw, role: 'ORGANIZER', organizerProfile: { create: { companyName: 'Approve Inc', status: 'PENDING' } } }
  });
  let orgReject = await prisma.user.upsert({
    where: { email: 'org-reject@test.com' },
    update: {},
    create: { email: 'org-reject@test.com', password: pw, role: 'ORGANIZER', organizerProfile: { create: { companyName: 'Reject Inc', status: 'PENDING' } } }
  });

  const profileApprove = await prisma.organizerProfile.findUnique({ where: { userId: orgApprove.id } });
  const profileReject = await prisma.organizerProfile.findUnique({ where: { userId: orgReject.id } });

  console.log("\n=== 1. Vendor tries to access admin routes (403) ===");
  let res = await req("/admin/overview", { cookie: vendorCookie });
  console.log(`Status: ${res.status} (expected 403)`);
  console.log(`Error: ${res.json.error?.code}`);

  console.log("\n=== 2. Admin approves a pending organizer ===");
  res = await req(`/admin/organizers/${profileApprove.id}/verify`, { method: "POST", cookie: adminCookie, body: { status: "APPROVED" } });
  console.log(`Status: ${res.status}`);

  console.log("\n=== 3. That organizer can now log in ===");
  let loginRes = await login("org-approve@test.com");
  console.log(`Login Status: ${loginRes.status}`);
  console.log(`Message: ${loginRes.json.message}`);

  console.log("\n=== 4. Admin double-approves (clean no-op) ===");
  res = await req(`/admin/organizers/${profileApprove.id}/verify`, { method: "POST", cookie: adminCookie, body: { status: "APPROVED" } });
  console.log(`Status: ${res.status}`);
  console.log(`Message: ${res.json.message}`);

  console.log("\n=== 5. Admin rejects an organizer with reason ===");
  res = await req(`/admin/organizers/${profileReject.id}/verify`, { method: "POST", cookie: adminCookie, body: { status: "REJECTED", reason: "Incomplete details" } });
  console.log(`Status: ${res.status}`);

  console.log("\n=== 6. Rejected organizer tries to log in ===");
  loginRes = await login("org-reject@test.com");
  console.log(`Login Status: ${loginRes.status} (expected 403)`);
  console.log(`Error Msg: ${loginRes.json.error?.message}`);
}

run();
