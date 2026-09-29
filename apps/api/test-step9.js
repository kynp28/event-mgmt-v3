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

  const req = async (path, opts) => {
    const r = await fetch(`http://localhost:4000/api${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", "Cookie": opts.cookie },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: r.status, json };
  };

  console.log("Logging in as vendor...");
  const vendorCookie = await login("vendor@eventcore.com");

  console.log("Getting an event...");
  const events = await prisma.event.findMany({ where: { status: "PUBLISHED" } });
  const event = events[0];

  if (!event) {
    console.log("No published event found");
    return;
  }

  console.log("Fetching booths via public endpoint...");
  const res = await req(`/events/${event.id}/booths`, { cookie: vendorCookie });
  console.log(`Fetch Status: ${res.status}`);
  console.log(`Booths array length: ${res.json.length}`);
  if (res.json.length > 0) {
    console.log("Sample booth:", res.json[0]);
  }
}
run();
