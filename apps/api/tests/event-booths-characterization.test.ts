import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";

const app = createApp({ loginRateLimit: false, registerRateLimit: false });

describe("GET /api/events/:id/booths - Current Behavior Characterization", () => {
  let users: Awaited<ReturnType<typeof createTestUsers>>;
  let cookies: Record<string, string[]> = {};
  
  let publishedEventId: string;
  let draftEventId: string;
  let closedEventId: string;

  beforeAll(async () => {
    await clearDb();
    users = await createTestUsers();

    // Login to get cookies
    for (const [key, email] of [
      ["admin", users.admin.email],
      ["org", users.org.email],
      ["vendor", users.vendor.email]
    ]) {
      const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
      cookies[key] = res.headers["set-cookie"];
    }

    // Create events
    const pubEvent = await createTestEvent(users.org.id);
    publishedEventId = pubEvent.id;

    const draftEvent = await db.event.create({
      data: {
        name: "Draft Event",
        location: "Test Location",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: "DRAFT",
        maxBoothsPerVendor: 2,
        organizerId: users.org.id
      }
    });
    draftEventId = draftEvent.id;

    const closedEvent = await db.event.create({
      data: {
        name: "Closed Event",
        location: "Test Location",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: "CLOSED",
        maxBoothsPerVendor: 2,
        organizerId: users.org.id
      }
    });
    closedEventId = closedEvent.id;

    // Create a booth for published event
    await db.booth.create({
      data: {
        eventId: publishedEventId,
        code: "PUB-A1",
        price: 100,
        status: "AVAILABLE",
        x: 10, y: 10, width: 2, height: 2, rotation: 0
      }
    });
    
    // Create a booth for draft event
    await db.booth.create({
      data: {
        eventId: draftEventId,
        code: "DR-A1",
        price: 100,
        status: "AVAILABLE"
      }
    });
  });

  it("Anonymous -> 200 (PUBLISHED), 404 (DRAFT)", async () => {
    const res = await request(app).get(`/api/events/${publishedEventId}/booths`);
    expect(res.status).toBe(200);
    const draftRes = await request(app).get(`/api/events/${draftEventId}/booths`);
    expect(draftRes.status).toBe(404);
  });

  it("VENDOR on PUBLISHED -> 200 with the exact key set per booth", async () => {
    const res = await request(app).get(`/api/events/${publishedEventId}/booths`).set("Cookie", cookies.vendor);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const booth = res.body[0];
    
    // Assert the exact key set
    const expectedKeys = [
      "id", "code", "price", "status", "physicalLength", "physicalWidth",
      "x", "y", "width", "height", "rotation", "zoneId"
    ].sort();
    
    expect(Object.keys(booth).sort()).toEqual(expectedKeys);
  });

  it("ORGANIZER (owner) and ADMIN on DRAFT -> 200", async () => {
    const resOrg = await request(app).get(`/api/events/${draftEventId}/booths`).set("Cookie", cookies.org);
    expect(resOrg.status).toBe(200);
    
    const resAdmin = await request(app).get(`/api/events/${draftEventId}/booths`).set("Cookie", cookies.admin);
    expect(resAdmin.status).toBe(200);
  });

  it("VENDOR on DRAFT -> 404", async () => {
    const res = await request(app).get(`/api/events/${draftEventId}/booths`).set("Cookie", cookies.vendor);
    expect(res.status).toBe(404);
  });

  it("VENDOR on CLOSED -> 404", async () => {
    const res = await request(app).get(`/api/events/${closedEventId}/booths`).set("Cookie", cookies.vendor);
    expect(res.status).toBe(404);
  });
});
