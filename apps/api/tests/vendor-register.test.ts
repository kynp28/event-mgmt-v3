import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers } from "./helpers";
import jwt from "jsonwebtoken";

// Use disabled limits for the main test block
const app = createApp({ registerRateLimit: false, loginRateLimit: false });

describe("Vendor Registration & Profile (A1)", () => {
  beforeEach(async () => {
    await clearDb();
  });

  const validVendorData = {
    email: "newvendor@test.com",
    password: "Password123",
    storeName: "Awesome Store",
    productType: "Clothing",
  };

  it("should prevent registration if password exceeds 72 bytes (73-char ASCII)", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({ ...validVendorData, password: "a".repeat(73) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.password._errors[0]).toMatch(/exceeds maximum length/);
  });

  it("should prevent registration if password exceeds 72 bytes (25-char Thai, 75 bytes)", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({ ...validVendorData, password: "ก".repeat(25) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.password._errors[0]).toMatch(/exceeds maximum length/);
  });

  it("should allow registration with exactly 72 bytes password (24-char Thai)", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({ ...validVendorData, password: "ก".repeat(24) });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validVendorData.email);
  });

  it("should successfully register a vendor, return no password, and set cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send(validVendorData);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Vendor registered successfully");
    expect(res.body.user.email).toBe(validVendorData.email);
    expect(res.body.user.role).toBe("VENDOR");
    expect(res.body.user.vendorProfile).toBeDefined();
    expect(res.body.user.vendorProfile.storeName).toBe(validVendorData.storeName);
    
    // Check that password is not leaked
    expect(res.body.user.password).toBeUndefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
  });

  it("should reject client-supplied role", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({ ...validVendorData, role: "ADMIN" });
    
    expect(res.status).toBe(400);
    // Strict schema should reject it
    const count = await db.user.count({ where: { email: validVendorData.email } });
    expect(count).toBe(0);
  });

  it("should reject unknown keys on register (extraKey)", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({ ...validVendorData, extraKey: "should-fail" });
    
    expect(res.status).toBe(400);
    const count = await db.user.count({ where: { email: validVendorData.email } });
    expect(count).toBe(0);
  });

  it("should prevent duplicate email registration (10 parallel requests)", async () => {
    const promises = Array.from({ length: 10 }).map(() => 
      request(app).post("/api/auth/register/vendor").send(validVendorData)
    );
    const results = await Promise.all(promises);
    
    const statuses = results.map(r => r.status);
    const createdCount = statuses.filter(s => s === 201).length;
    const conflictCount = statuses.filter(s => s === 409).length;

    expect(createdCount).toBe(1);
    expect(conflictCount).toBe(9);

    const dbCount = await db.user.count({ where: { email: validVendorData.email } });
    expect(dbCount).toBe(1);
    
    // Check error structure
    const conflictRes = results.find(r => r.status === 409);
    expect(conflictRes?.body.error.code).toBe("CONFLICT");
  });

  it("should validate missing/invalid fields on register", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({
        email: "invalid-email",
        password: "short",
        storeName: "A".repeat(101),
        productType: "",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBeDefined();
    expect(res.body.error.details.password).toBeDefined();
    expect(res.body.error.details.storeName).toBeDefined();
    expect(res.body.error.details.productType).toBeDefined();
  });

  it("should validate invalid fields on PUT", async () => {
    const users = await createTestUsers();
    const token = jwt.sign({ userId: users.vendor.id }, process.env.JWT_SECRET!);

    const res = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${token}`)
      .send({
        productType: "A".repeat(101),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.storeName).toBeDefined(); // required
    expect(res.body.error.details.productType).toBeDefined(); // max 100
  });

  it("should reject unknown keys on PUT (extraKey)", async () => {
    const users = await createTestUsers();
    const token = jwt.sign({ userId: users.vendor.id }, process.env.JWT_SECRET!);

    const res = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${token}`)
      .send({
        storeName: "Valid Store",
        productType: "Valid Product",
        extraKey: "should-fail"
      });

    expect(res.status).toBe(400);
  });

  it("should handle profile lifecycle (GET 404, PUT 201, GET 200, PUT 200)", async () => {
    const users = await createTestUsers();
    const token = jwt.sign({ userId: users.vendor.id }, process.env.JWT_SECRET!);

    // 1. GET 404
    const get1 = await request(app)
      .get("/api/vendor/profile")
      .set("Cookie", `token=${token}`);
    expect(get1.status).toBe(404);
    expect(get1.body.error.code).toBe("VENDOR_PROFILE_NOT_FOUND");

    // 2. PUT 201 (create)
    const put1 = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${token}`)
      .send({ storeName: "First Store", productType: "Type A" });
    expect(put1.status).toBe(201);
    expect(put1.body.profile.storeName).toBe("First Store");

    // 3. GET 200
    const get2 = await request(app)
      .get("/api/vendor/profile")
      .set("Cookie", `token=${token}`);
    expect(get2.status).toBe(200);
    expect(get2.body.profile.storeName).toBe("First Store");

    // 4. PUT 200 (update)
    const put2 = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${token}`)
      .send({ storeName: "Second Store", productType: "Type B" });
    expect(put2.status).toBe(200);
    expect(put2.body.profile.storeName).toBe("Second Store");
  });

  it("should handle 20 parallel PUTs safely (upsert concurrency)", async () => {
    const users = await createTestUsers();
    const token = jwt.sign({ userId: users.vendor.id }, process.env.JWT_SECRET!);

    const promises = Array.from({ length: 20 }).map(() =>
      request(app)
        .put("/api/vendor/profile")
        .set("Cookie", `token=${token}`)
        .send({ storeName: "Concurrent Store", productType: "Any" })
    );

    const results = await Promise.allSettled(promises);
    const rejected = results.filter(r => r.status === "rejected");
    expect(rejected.length).toBe(0);

    const fulfilled = results as PromiseFulfilledResult<request.Response>[];
    const statuses = fulfilled.map(r => r.value.status);
    
    const createdCount = statuses.filter(s => s === 201).length;
    const updatedCount = statuses.filter(s => s === 200).length;
    
    expect(createdCount).toBe(1);
    expect(updatedCount).toBe(19);
    
    // Check DB row count
    const profileCount = await db.vendorProfile.count({ where: { userId: users.vendor.id } });
    expect(profileCount).toBe(1);

    console.log(`Parallel PUTs: 201=${createdCount}, 200=${updatedCount}, dbCount=${profileCount}`);
  });

  it("should enforce access control for profile routes correctly between roles and users", async () => {
    const users = await createTestUsers();
    // users.vendor is vendor A
    
    // Create vendor A's profile
    await db.vendorProfile.create({
      data: { userId: users.vendor.id, storeName: "Vendor A Store", productType: "Prod A" }
    });

    const vendorB = await db.user.create({
      data: { email: "vendorb@test.com", password: "pwd", role: "VENDOR" }
    });
    await db.vendorProfile.create({
      data: { userId: vendorB.id, storeName: "Vendor B Store", productType: "Prod B" }
    });

    const adminToken = jwt.sign({ userId: users.admin.id }, process.env.JWT_SECRET!);
    const orgToken = jwt.sign({ userId: users.org.id }, process.env.JWT_SECRET!);
    const vendorBToken = jwt.sign({ userId: vendorB.id }, process.env.JWT_SECRET!);

    // 1. GET and PUT without cookie -> 401
    expect((await request(app).get("/api/vendor/profile")).status).toBe(401);
    expect((await request(app).put("/api/vendor/profile").send({ storeName: "S", productType: "P" })).status).toBe(401);

    // 2. PUT as ADMIN -> 403
    expect((await request(app).put("/api/vendor/profile").set("Cookie", `token=${adminToken}`).send({ storeName: "S", productType: "P" })).status).toBe(403);
    
    // 3. PUT as ORGANIZER -> 403
    expect((await request(app).put("/api/vendor/profile").set("Cookie", `token=${orgToken}`).send({ storeName: "S", productType: "P" })).status).toBe(403);

    // Snapshot A
    const vendorABefore = await db.vendorProfile.findUnique({ where: { userId: users.vendor.id } });
    expect(vendorABefore).not.toBeNull();

    // 4. PUT as vendor B does not change vendor A
    const putRes = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${vendorBToken}`)
      .send({ storeName: "New B Store", productType: "New B Prod" });
    expect(putRes.status).toBe(200);

    const vendorAAfter1 = await db.vendorProfile.findUnique({ where: { userId: users.vendor.id } });
    expect(vendorAAfter1).toEqual(vendorABefore);

    // 5. PUT as vendor B trying to set userId to A's id -> 400 (strict) and A is unchanged
    const maliciousPut = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${vendorBToken}`)
      .send({ storeName: "Malicious Store", productType: "Malicious Prod", userId: users.vendor.id });
    expect(maliciousPut.status).toBe(400);

    const vendorAAfter2 = await db.vendorProfile.findUnique({ where: { userId: users.vendor.id } });
    expect(vendorAAfter2).toEqual(vendorABefore);
  });
});

describe("Vendor Registration Rate Limiting", () => {
  const limitApp = createApp({ registerRateLimit: { max: 2, windowMs: 60000 } });

  beforeAll(async () => {
    await clearDb();
  });

  it("should return 429 after exceeding limit", async () => {
    const res1 = await request(limitApp).post("/api/auth/register/vendor").send({ email: "r1@test.com", password: "Password123", storeName: "S", productType: "P" });
    const res2 = await request(limitApp).post("/api/auth/register/vendor").send({ email: "r2@test.com", password: "Password123", storeName: "S", productType: "P" });
    const res3 = await request(limitApp).post("/api/auth/register/vendor").send({ email: "r3@test.com", password: "Password123", storeName: "S", productType: "P" });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res3.status).toBe(429); // Exceeds max 2
    expect(res3.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});
