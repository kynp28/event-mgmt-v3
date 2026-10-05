import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb } from "./helpers";
import express from "express";

const app = createApp();

describe("Vendor Registration & Profile (A1)", () => {
  beforeAll(async () => {
    await clearDb();
  });

  const validVendorData = {
    email: "newvendor@test.com",
    password: "Password123",
    name: "John Vendor",
    storeName: "Awesome Store",
    productType: "Clothing",
  };

  let vendorToken = "";

  it("should prevent registration if password exceeds 72 bytes (73-char ASCII)", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({
        ...validVendorData,
        email: "fail1@test.com",
        password: "a".repeat(73),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.password._errors[0]).toMatch(/exceeds maximum length/);
  });

  it("should prevent registration if password exceeds 72 bytes (25-char Thai, 75 bytes)", async () => {
    // 25 chars of Thai, e.g. "ก" is 3 bytes in UTF-8
    const thaiPassword = "ก".repeat(25); 
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({
        ...validVendorData,
        email: "fail2@test.com",
        password: thaiPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.password._errors[0]).toMatch(/exceeds maximum length/);
  });

  it("should allow registration with exactly 72 bytes password (24-char Thai)", async () => {
    // 24 chars of Thai -> 72 bytes
    const thaiPassword = "ก".repeat(24);
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send({
        ...validVendorData,
        email: "success1@test.com",
        password: thaiPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("success1@test.com");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("should successfully register a vendor and set cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send(validVendorData);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Vendor registered successfully");
    expect(res.body.user.email).toBe(validVendorData.email);
    expect(res.body.user.role).toBe("VENDOR");
    expect(res.body.user.vendorProfile).toBeDefined();
    expect(res.body.user.vendorProfile.storeName).toBe(validVendorData.storeName);

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    vendorToken = tokenCookie.split(";")[0].split("=")[1];
  });

  it("should prevent duplicate email registration", async () => {
    const res = await request(app)
      .post("/api/auth/register/vendor")
      .send(validVendorData);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("should fetch vendor profile successfully", async () => {
    const res = await request(app)
      .get("/api/vendor/profile")
      .set("Cookie", `token=${vendorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.storeName).toBe(validVendorData.storeName);
    expect(res.body.profile.productType).toBe(validVendorData.productType);
  });

  it("should update vendor profile successfully", async () => {
    const res = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${vendorToken}`)
      .send({
        storeName: "Updated Store Name",
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.storeName).toBe("Updated Store Name");
    expect(res.body.profile.productType).toBe(validVendorData.productType); // Unchanged
  });

  it("should reject update if invalid input", async () => {
    const res = await request(app)
      .put("/api/vendor/profile")
      .set("Cookie", `token=${vendorToken}`)
      .send({
        storeName: "", // Min length 1
      });

    expect(res.status).toBe(400);
  });
});
