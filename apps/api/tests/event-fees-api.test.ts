import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";

const app = createApp({ loginRateLimit: false, registerRateLimit: false });

function getAuthCookie(userId: string): string[] {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!);
  return [`token=${token}`];
}

describe("Event Fees API", () => {
  let users: Awaited<ReturnType<typeof createTestUsers>>;
  let otherOrg: { id: string; email: string };
  let event: Awaited<ReturnType<typeof createTestEvent>>;

  beforeEach(async () => {
    await clearDb();
    users = await createTestUsers();

    const password = await bcrypt.hash("password123", 10);
    otherOrg = await db.user.create({
      data: {
        email: "other_org@test.com",
        password,
        role: "ORGANIZER",
        organizerProfile: {
          create: { companyName: "Other Org", status: "APPROVED" }
        }
      }
    });

    event = await createTestEvent(users.org.id);
  });

  describe("Organizer CRUD Happy Path & Access Control", () => {
    it("handles happy path: create (201), list (200), update (200), delete (204)", async () => {
      // 1. Create fee (201)
      const createRes = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          name: "Cleaning Fee",
          type: "PER_BOOKING",
          amount: "50.00"
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.name).toBe("Cleaning Fee");
      expect(createRes.body.type).toBe("PER_BOOKING");
      expect(createRes.body.amount).toBe("50");
      const feeId = createRes.body.id;

      // 2. List fees (200)
      const listRes = await request(app)
        .get(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id));

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(feeId);

      // 3. Update fee (200)
      const updateRes = await request(app)
        .put(`/api/organizer/events/${event.id}/fees/${feeId}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          name: "Deep Cleaning Fee",
          type: "PER_BOOTH",
          amount: "75.50"
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe("Deep Cleaning Fee");
      expect(updateRes.body.type).toBe("PER_BOOTH");
      expect(updateRes.body.amount).toBe("75.5");

      // 4. Delete fee (204)
      const deleteRes = await request(app)
        .delete(`/api/organizer/events/${event.id}/fees/${feeId}`)
        .set("Cookie", getAuthCookie(users.org.id));

      expect(deleteRes.status).toBe(204);

      // Verify deletion
      const afterDeleteList = await request(app)
        .get(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id));
      expect(afterDeleteList.status).toBe(200);
      expect(afterDeleteList.body).toHaveLength(0);
    });

    it("returns 404 when another organizer attempts list, create, update, or delete", async () => {
      // First create a fee as the owner
      const createRes = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Service Fee", type: "PER_BOOKING", amount: "20.00" });
      expect(createRes.status).toBe(201);
      const feeId = createRes.body.id;

      // Other organizer tries to list -> 404
      const listRes = await request(app)
        .get(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(otherOrg.id));
      expect(listRes.status).toBe(404);
      expect(listRes.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries to create -> 404
      const otherCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(otherOrg.id))
        .send({ name: "Hack Fee", type: "PER_BOOKING", amount: "10.00" });
      expect(otherCreate.status).toBe(404);
      expect(otherCreate.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries to update -> 404
      const otherUpdate = await request(app)
        .put(`/api/organizer/events/${event.id}/fees/${feeId}`)
        .set("Cookie", getAuthCookie(otherOrg.id))
        .send({ name: "Hacked Fee", type: "PER_BOOKING", amount: "15.00" });
      expect(otherUpdate.status).toBe(404);
      expect(otherUpdate.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries to delete -> 404
      const otherDelete = await request(app)
        .delete(`/api/organizer/events/${event.id}/fees/${feeId}`)
        .set("Cookie", getAuthCookie(otherOrg.id));
      expect(otherDelete.status).toBe(404);
      expect(otherDelete.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 for vendor and 401 for anonymous on organizer fee endpoints", async () => {
      // Vendor gets 403
      const vendorList = await request(app)
        .get(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.vendor.id));
      expect(vendorList.status).toBe(403);
      expect(vendorList.body.error.code).toBe("FORBIDDEN");

      const vendorCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.vendor.id))
        .send({ name: "Vendor Fee", type: "PER_BOOKING", amount: "10.00" });
      expect(vendorCreate.status).toBe(403);
      expect(vendorCreate.body.error.code).toBe("FORBIDDEN");

      // No token gets 401
      const anonList = await request(app)
        .get(`/api/organizer/events/${event.id}/fees`);
      expect(anonList.status).toBe(401);
      expect(anonList.body.error.code).toBe("UNAUTHORIZED");

      const anonCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .send({ name: "Anon Fee", type: "PER_BOOKING", amount: "10.00" });
      expect(anonCreate.status).toBe(401);
      expect(anonCreate.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Validation Errors (400 VALIDATION_ERROR)", () => {
    it("rejects negative amount", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Negative Fee", type: "PER_BOOKING", amount: "-10.00" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects 3 decimal places in amount", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Precision Fee", type: "PER_BOOKING", amount: "10.123" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unknown extra key (strict schema)", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Extra Fee", type: "PER_BOOKING", amount: "10.00", unexpected: true });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects name exceeding 100 characters", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "A".repeat(101), type: "PER_BOOKING", amount: "10.00" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects empty name or whitespace-only name", async () => {
      const res1 = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "", type: "PER_BOOKING", amount: "10.00" });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("VALIDATION_ERROR");

      const res2 = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "   ", type: "PER_BOOKING", amount: "10.00" });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid fee type", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Bad Type Fee", type: "INVALID_TYPE", amount: "10.00" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Duplicate Name Conflict & 20-Fee Cap", () => {
    it("returns 409 CONFLICT on duplicate fee name on create and update", async () => {
      // Create first fee
      const res1 = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Security Fee", type: "PER_BOOKING", amount: "25.00" });
      expect(res1.status).toBe(201);

      // Create duplicate name -> 409 CONFLICT
      const resDup = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Security Fee", type: "PER_BOOTH", amount: "30.00" });
      expect(resDup.status).toBe(409);
      expect(resDup.body.error.code).toBe("CONFLICT");

      // Create a second distinct fee
      const res2 = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Water Fee", type: "PER_BOOTH", amount: "15.00" });
      expect(res2.status).toBe(201);

      // Update second fee to duplicate the first fee's name -> 409 CONFLICT
      const resUpdateDup = await request(app)
        .put(`/api/organizer/events/${event.id}/fees/${res2.body.id}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Security Fee", type: "PER_BOOTH", amount: "15.00" });
      expect(resUpdateDup.status).toBe(409);
      expect(resUpdateDup.body.error.code).toBe("CONFLICT");
    });

    it("returns 400 LIMIT_EXCEEDED when attempting to create a 21st fee", async () => {
      // Create 20 fees
      for (let i = 1; i <= 20; i++) {
        const res = await request(app)
          .post(`/api/organizer/events/${event.id}/fees`)
          .set("Cookie", getAuthCookie(users.org.id))
          .send({ name: `Fee ${i}`, type: "PER_BOOKING", amount: "10.00" });
        expect(res.status).toBe(201);
      }

      // 21st fee -> 400 LIMIT_EXCEEDED
      const res21 = await request(app)
        .post(`/api/organizer/events/${event.id}/fees`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Fee 21", type: "PER_BOOKING", amount: "10.00" });
      expect(res21.status).toBe(400);
      expect(res21.body.error.code).toBe("LIMIT_EXCEEDED");
    });
  });

  describe("Public GET /api/events/:id/fees", () => {
    it("returns 404 for unknown event id", async () => {
      const res = await request(app).get("/api/events/non-existent-id/fees");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for DRAFT event", async () => {
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

      const res = await request(app).get(`/api/events/${draftEvent.id}/fees`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 200 with exactly the keys [amount, name, type] for PUBLISHED event, anonymous allowed", async () => {
      // Create two fees
      await db.eventFee.create({
        data: { eventId: event.id, name: "Electricity", type: "PER_BOOTH", amount: "25.00" }
      });
      await db.eventFee.create({
        data: { eventId: event.id, name: "Cleaning", type: "PER_BOOKING", amount: "50.00" }
      });

      // Anonymous request (no token / cookie)
      const res = await request(app).get(`/api/events/${event.id}/fees`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const expectedKeys = ["amount", "name", "type"];
      for (const item of res.body) {
        expect(Object.keys(item).sort()).toEqual(expectedKeys);
      }

      expect(res.body[0]).toEqual({
        name: "Electricity",
        type: "PER_BOOTH",
        amount: "25"
      });
      expect(res.body[1]).toEqual({
        name: "Cleaning",
        type: "PER_BOOKING",
        amount: "50"
      });
    });
  });
});
