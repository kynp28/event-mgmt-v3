async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    return r.headers.getSetCookie()[0].split(";")[0];
  };

  const req = async (path, opts) => {
    const headers = { "Content-Type": "application/json" };
    if (opts.cookie) headers["Cookie"] = opts.cookie;
    const r = await fetch(`http://localhost:4000/api${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    console.log(`[${opts.method}] ${path} -> ${r.status}`);
    if (r.status >= 400) console.log(`   Error: ${JSON.stringify(json?.error)}`);
    return { status: r.status, json };
  };

  const org1Cookie = await login("organizer@eventcore.com");
  const org2Cookie = await login("organizer2@eventcore.com");

  // Create Event for Org 1
  let res = await req("/organizer/events", {
    method: "POST", cookie: org1Cookie,
    body: { name: "Org1 Event", location: "BKK", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const event1 = res.json.id;

  // Create Event for Org 2
  res = await req("/organizer/events", {
    method: "POST", cookie: org2Cookie,
    body: { name: "Org2 Event", location: "CNX", startDate: "2026-12-01", endDate: "2026-12-02", maxBoothsPerVendor: 2 }
  });
  const event2 = res.json.id;

  // 1. Create Zone
  res = await req(`/organizer/events/${event1}/zones`, {
    method: "POST", cookie: org1Cookie, body: { name: "VIP Zone" }
  });
  const zone1 = res.json.id;
  console.log("-> Create zone OK:", res.json.name);

  // 2. Create Booth
  res = await req(`/organizer/events/${event1}/booths`, {
    method: "POST", cookie: org1Cookie, body: { code: "V1", zoneId: zone1, price: "100.50" }
  });
  const booth1 = res.json.id;
  console.log("-> Create booth OK:", res.json.code);

  // 3. Duplicate booth code in same event -> 409
  res = await req(`/organizer/events/${event1}/booths`, {
    method: "POST", cookie: org1Cookie, body: { code: "V1", zoneId: zone1, price: "50" }
  });
  console.log("-> Duplicate code same event:", res.status === 409 ? "PASS (409)" : "FAIL");

  // 4. Duplicate code across different events -> allowed
  res = await req(`/organizer/events/${event2}/booths`, {
    method: "POST", cookie: org2Cookie, body: { code: "V1", price: "75" }
  });
  console.log("-> Duplicate code different event:", res.status === 201 ? "PASS (201)" : "FAIL");

  // 5. Organizer edits a booth on another organizer's event -> 404
  res = await req(`/organizer/events/${event1}/booths/${booth1}`, {
    method: "PATCH", cookie: org2Cookie, body: { price: "999" }
  });
  console.log("-> Edit another org's booth:", res.status === 404 ? "PASS (404)" : "FAIL");

  // 6. Attempt to set a booth's status to BOOKED directly -> rejected
  res = await req(`/organizer/events/${event1}/booths/${booth1}`, {
    method: "PATCH", cookie: org1Cookie, body: { status: "BOOKED" }
  });
  console.log("-> Set status to BOOKED:", res.status === 400 ? "PASS (400)" : "FAIL");

  // 7. Delete a zone that has booths -> booths survive with zoneId null
  res = await req(`/organizer/events/${event1}/zones/${zone1}`, {
    method: "DELETE", cookie: org1Cookie
  });
  res = await req(`/organizer/events/${event1}/booths`, {
    method: "GET", cookie: org1Cookie
  });
  const boothSurvives = res.json.find(b => b.id === booth1);
  console.log("-> Delete zone (booth survives with null zoneId):", 
    boothSurvives && boothSurvives.zoneId === null ? "PASS" : "FAIL");
}

run();
