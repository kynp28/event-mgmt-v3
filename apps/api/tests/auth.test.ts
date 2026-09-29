import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { clearDb, createTestUsers } from "./helpers";
import { login, getMe } from "../src/controllers/auth.controller";
import { requireAuth } from "../src/middlewares/auth.middleware";

// Create a test app using the exact same handlers
const app = express();
app.use(express.json());
app.use(cookieParser());
app.post("/api/auth/login", login);
app.get("/api/auth/me", requireAuth, getMe);

describe("Auth Integration", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should authenticate Admin successfully", async () => {
    await createTestUsers();
    
    // Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password123" });
    
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.header["set-cookie"];

    // Check Me
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookies);
    
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe("ADMIN");
  });

  it("should authenticate Organizer successfully", async () => {
    await createTestUsers();
    
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "org@test.com", password: "password123" });
    const cookies = loginRes.header["set-cookie"];

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookies);
    
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe("ORGANIZER");
  });

  it("should authenticate Vendor successfully", async () => {
    await createTestUsers();
    
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "vendor@test.com", password: "password123" });
    const cookies = loginRes.header["set-cookie"];

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookies);
    
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.role).toBe("VENDOR");
  });

  it("should reject invalid token", async () => {
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", ["token=invalid.jwt.token"]);
    
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe("UNAUTHORIZED");
  });
});
