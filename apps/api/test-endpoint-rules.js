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

  const req = async (path, cookie) => {
    const r = await fetch(`http://localhost:4000/api${path}`, {
      headers: cookie ? { "Cookie": cookie } : {}
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { json = text; }
    return { status: r.status, json };
  };

  // Get a draft event
  let draftEvent = await prisma.event.findFirst({ where: { status: "DRAFT" } });
  if (!draftEvent) {
    console.log("No draft event found, creating one...");
    draftEvent = await prisma.event.create({
      data: {
        name: "Test Draft", location: "Test", startDate: new Date(), endDate: new Date(),
        status: "DRAFT", organizerId: "cmul5ijq30001vcps72o3jmyz" // assuming valid org id
      }
    });
  }

  // Get a published event
  const pubEvent = await prisma.event.findFirst({ where: { status: "PUBLISHED" } });

  console.log("--- TEST A: ANONYMOUS REQUEST ---");
  const resAnon = await req(`/events/${pubEvent.id}/booths`, null);
  console.log(`Status: ${resAnon.status}`);
  console.log(`Body:`, resAnon.json);

  console.log("\n--- TEST B: VENDOR REQUESTING DRAFT EVENT ---");
  const vendorCookie = await login("vendor@eventcore.com");
  const resDraft = await req(`/events/${draftEvent.id}/booths`, vendorCookie);
  console.log(`Status: ${resDraft.status}`);
  console.log(`Body:`, resDraft.json);

  console.log("\n--- TEST C: VENDOR REQUESTING PUBLISHED EVENT (Check Fields) ---");
  const resPub = await req(`/events/${pubEvent.id}/booths`, vendorCookie);
  console.log(`Status: ${resPub.status}`);
  if (resPub.json.length > 0) {
    console.log("Sample Response Object Keys:", Object.keys(resPub.json[0]));
    console.log("Full Object:", resPub.json[0]);
  } else {
    console.log("No booths found to inspect");
  }

  process.exit(0);
}
run();
