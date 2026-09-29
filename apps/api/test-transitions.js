const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    const cookieHeader = r.headers.getSetCookie();
    return cookieHeader ? cookieHeader[0].split(";")[0] : null;
  };

  const req = async (path, cookie, body) => {
    const r = await fetch(`http://localhost:4000/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: r.status, json };
  };

  const adminCookie = await login("admin@eventcore.com");

  // Create an organizer specifically for this test
  const pw = await require('bcryptjs').hash('password123', 10);
  const email = "org-transitions@test.com";
  let org = await prisma.user.upsert({
    where: { email },
    update: { organizerProfile: { update: { status: 'PENDING' } } },
    create: { email, password: pw, role: 'ORGANIZER', organizerProfile: { create: { companyName: 'Trans Test', status: 'PENDING' } } }
  });
  const profileId = (await prisma.organizerProfile.findUnique({ where: { userId: org.id } })).id;

  console.log("=== 1. Reject the organizer ===");
  let res = await req(`/admin/organizers/${profileId}/verify`, adminCookie, { status: "REJECTED", reason: "First reject" });
  console.log(`Status: ${res.status}`);

  console.log("\n=== 2. Double-reject the organizer ===");
  res = await req(`/admin/organizers/${profileId}/verify`, adminCookie, { status: "REJECTED", reason: "Second reject" });
  console.log(`Status: ${res.status} (expected 200 no-op)`);
  console.log(`Message: ${res.json.message}`);

  console.log("\n=== 3. Approve the organizer ===");
  res = await req(`/admin/organizers/${profileId}/verify`, adminCookie, { status: "APPROVED" });
  console.log(`Status: ${res.status}`);

  console.log("\n=== 4. Reject the approved organizer ===");
  res = await req(`/admin/organizers/${profileId}/verify`, adminCookie, { status: "REJECTED", reason: "Reject again" });
  console.log(`Status: ${res.status} (expected 400)`);
  console.log(`Error: ${res.json.error?.code}`);
}
run();
