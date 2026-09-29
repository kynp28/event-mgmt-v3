async function run() {
  const login = async (email, password = "password123") => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: r.status, json };
  };

  console.log("=== 1. Login Admin ===");
  let res = await login("admin@eventcore.com");
  console.log(`Status: ${res.status}`);
  console.log(`Role: ${res.json.user?.role}`);

  console.log("\n=== 2. Login Vendor ===");
  res = await login("vendor@eventcore.com");
  console.log(`Status: ${res.status}`);
  console.log(`Role: ${res.json.user?.role}`);

  console.log("\n=== 3. Login Organizer (Approved) ===");
  res = await login("organizer@eventcore.com");
  console.log(`Status: ${res.status}`);
  console.log(`Role: ${res.json.user?.role}`);

  console.log("\n=== 4. Login Wrong Password ===");
  res = await login("admin@eventcore.com", "wrongpass");
  console.log(`Status: ${res.status}`);
  console.log(`Error Body:`, res.json);
  
  console.log("\n=== 5. Login User Not Found ===");
  res = await login("nonexistent@eventcore.com", "wrongpass");
  console.log(`Status: ${res.status}`);
  console.log(`Error Body:`, res.json);
}
run();
