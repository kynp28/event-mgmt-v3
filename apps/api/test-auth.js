async function run() {
  const login = async (email) => {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    const cookieHeader = r.headers.getSetCookie();
    return cookieHeader ? cookieHeader[0].split(";")[0] : null;
  };

  const checkMe = async (cookie) => {
    const r = await fetch("http://localhost:4000/api/auth/me", {
      headers: cookie ? { "Cookie": cookie } : {}
    });
    return { status: r.status, data: await r.json() };
  };

  console.log("1. Testing Admin...");
  const adminCookie = await login("admin@eventcore.com");
  const adminRes = await checkMe(adminCookie);
  console.log("Admin /me status:", adminRes.status, "| Role:", adminRes.data.user?.role);

  console.log("\n2. Testing Organizer...");
  const orgCookie = await login("organizer@eventcore.com");
  const orgRes = await checkMe(orgCookie);
  console.log("Organizer /me status:", orgRes.status, "| Role:", orgRes.data.user?.role);

  console.log("\n3. Testing Vendor...");
  const venCookie = await login("vendor@eventcore.com");
  const venRes = await checkMe(venCookie);
  console.log("Vendor /me status:", venRes.status, "| Role:", venRes.data.user?.role);

  console.log("\n4. Testing Invalid Token...");
  const invalidRes = await checkMe("token=invalid.jwt.token");
  console.log("Invalid token /me status:", invalidRes.status, "| Response:", invalidRes.data);
  
  process.exit(0);
}
run();
