import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers } from "./helpers";

const app = createApp({ loginRateLimit: false });

describe("Auth Login DTO", () => {
  let users: Awaited<ReturnType<typeof createTestUsers>>;

  beforeAll(async () => {
    await clearDb();
    users = await createTestUsers();
  });

  const getLoginPayload = (email: string) => ({ email, password: "password123" });

  it("should return EXACTLY id, email, name, role for ADMIN, ORGANIZER and VENDOR", async () => {
    for (const [role, email] of [
      ["ADMIN", users.admin.email],
      ["ORGANIZER", users.org.email],
      ["VENDOR", users.vendor.email]
    ]) {
      const res = await request(app).post("/api/auth/login").send(getLoginPayload(email));
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();
      
      expect(Object.keys(res.body.user).sort()).toEqual(["email", "id", "name", "role"]);
      expect(res.body.user.role).toBe(role);
    }
  });

  it("should completely omit password and not leak bcrypt hash", async () => {
    for (const email of [users.admin.email, users.org.email, users.vendor.email]) {
      const res = await request(app).post("/api/auth/login").send(getLoginPayload(email));
      
      const responseText = JSON.stringify(res.body);
      
      // Should not contain the key 'password'
      expect(responseText).not.toContain('"password"');
      
      // Should not contain bcrypt hashes anywhere in the response
      expect(responseText).not.toMatch(/\$2[aby]\$/);
    }
  });

  it("should return 401 on wrong password or unknown email", async () => {
    const wrongPwd = await request(app).post("/api/auth/login").send({ email: users.admin.email, password: "wrong" });
    expect(wrongPwd.status).toBe(401);
    expect(wrongPwd.body.error.message).toBe("Invalid email or password");

    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "nope@test.com", password: "Password123" });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.message).toBe("Invalid email or password");
  });

  it("should return 403 ORGANIZER_NOT_APPROVED for unapproved organizer", async () => {
    const pendingOrg = await db.user.create({
      data: {
        email: "pending@org.com",
        name: "Pending Org",
        password: users.org.password, // hashed "Password123"
        role: "ORGANIZER",
        organizerProfile: {
          create: { companyName: "Pending Ltd", status: "PENDING" }
        }
      }
    });

    const res = await request(app).post("/api/auth/login").send(getLoginPayload(pendingOrg.email));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORGANIZER_NOT_APPROVED");
  });

  it("should still return correct user role on GET /api/auth/me", async () => {
    const loginRes = await request(app).post("/api/auth/login").send(getLoginPayload(users.vendor.email));
    const cookies = loginRes.headers["set-cookie"];
    
    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookies);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe("VENDOR");
  });
});
