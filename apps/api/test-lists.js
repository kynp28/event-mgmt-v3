const { PrismaClient } = require('@prisma/client');

async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    const cookieHeader = r.headers.getSetCookie();
    return cookieHeader ? cookieHeader[0].split(";")[0] : null;
  };

  const req = async (path, cookie) => {
    const r = await fetch(`http://localhost:4000/api${path}`, { headers: { "Cookie": cookie } });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: r.status, json };
  };

  const adminCookie = await login("admin@eventcore.com");
  const vendorCookie = await login("vendor@eventcore.com");

  console.log("=== GET /api/admin/users as Admin ===");
  let res = await req("/admin/users", adminCookie);
  console.log(`Status: ${res.status}`);
  console.log(`Data length: ${res.json.length}`);
  console.log(`Sample item:`, res.json[0]);

  console.log("\n=== GET /api/admin/events as Admin ===");
  res = await req("/admin/events", adminCookie);
  console.log(`Status: ${res.status}`);
  console.log(`Data length: ${res.json.length}`);
  console.log(`Sample item:`, res.json[0]);

  console.log("\n=== GET /api/admin/users as Vendor ===");
  res = await req("/admin/users", vendorCookie);
  console.log(`Status: ${res.status} (expected 403)`);
}
run();
