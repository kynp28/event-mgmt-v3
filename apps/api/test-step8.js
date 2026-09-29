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

  console.log("Logging in as organizer...");
  const orgCookie = await login("organizer@eventcore.com");

  console.log("Getting an event...");
  const events = await prisma.event.findMany({ where: { organizer: { email: "organizer@eventcore.com" } } });
  const event = events[0];

  console.log("Creating two booths...");
  const b1 = await req(`/organizer/events/${event.id}/booths`, { method: "POST", cookie: orgCookie, body: { code: "B1", price: 100 } });
  const b2 = await req(`/organizer/events/${event.id}/booths`, { method: "POST", cookie: orgCookie, body: { code: "B2", price: 200 } });
  const booth1Id = b1.json.id;
  const booth2Id = b2.json.id;

  console.log("Updating positions...");
  const res = await req(`/organizer/events/${event.id}/booths/positions`, {
    method: "PUT",
    cookie: orgCookie,
    body: {
      positions: [
        { boothId: booth1Id, x: 100, y: 150, width: 200, height: 200, rotation: 0 },
        { boothId: booth2Id, x: null, y: null, width: null, height: null, rotation: null },
      ]
    }
  });
  console.log(`Update Status: ${res.status}`);

  const check = await req(`/organizer/events/${event.id}/booths`, { cookie: orgCookie });
  const fetchedB1 = check.json.find(b => b.id === booth1Id);
  const fetchedB2 = check.json.find(b => b.id === booth2Id);

  console.log("Booth 1:", { x: fetchedB1.x, y: fetchedB1.y, width: fetchedB1.width });
  console.log("Booth 2:", { x: fetchedB2.x, y: fetchedB2.y, width: fetchedB2.width });

  // Cleanup
  await req(`/organizer/events/${event.id}/booths/${booth1Id}`, { method: "DELETE", cookie: orgCookie });
  await req(`/organizer/events/${event.id}/booths/${booth2Id}`, { method: "DELETE", cookie: orgCookie });
}
run();
