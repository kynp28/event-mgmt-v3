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

describe("Booth Types API", () => {
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
      // 1. Create booth type (201)
      const createRes = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          name: "Standard Booth",
          price: "300.00",
          physicalWidth: "3.00",
          physicalLength: "3.00"
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.name).toBe("Standard Booth");
      expect(createRes.body.price).toBe("300");
      expect(createRes.body.physicalWidth).toBe("3");
      expect(createRes.body.physicalLength).toBe("3");
      const typeId = createRes.body.id;

      // 2. List booth types (200)
      const listRes = await request(app)
        .get(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id));

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(typeId);

      // 3. Update booth type (200)
      const updateRes = await request(app)
        .put(`/api/organizer/events/${event.id}/booth-types/${typeId}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          name: "Premium Booth",
          price: "500.00",
          physicalWidth: "4.00",
          physicalLength: "4.00"
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe("Premium Booth");
      expect(updateRes.body.price).toBe("500");
      expect(updateRes.body.physicalWidth).toBe("4");
      expect(updateRes.body.physicalLength).toBe("4");

      // 4. Delete booth type (204)
      const deleteRes = await request(app)
        .delete(`/api/organizer/events/${event.id}/booth-types/${typeId}`)
        .set("Cookie", getAuthCookie(users.org.id));

      expect(deleteRes.status).toBe(204);

      // Verify deletion
      const afterDeleteList = await request(app)
        .get(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id));
      expect(afterDeleteList.status).toBe(200);
      expect(afterDeleteList.body).toHaveLength(0);
    });

    it("returns 404 when another organizer attempts list, create, update, or delete", async () => {
      // Create booth type as owner
      const createRes = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Corner Booth", price: "400.00" });
      expect(createRes.status).toBe(201);
      const typeId = createRes.body.id;

      // Other organizer tries list -> 404
      const listRes = await request(app)
        .get(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(otherOrg.id));
      expect(listRes.status).toBe(404);
      expect(listRes.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries create -> 404
      const createOther = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(otherOrg.id))
        .send({ name: "Hacked Booth Type", price: "100.00" });
      expect(createOther.status).toBe(404);
      expect(createOther.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries update -> 404
      const updateOther = await request(app)
        .put(`/api/organizer/events/${event.id}/booth-types/${typeId}`)
        .set("Cookie", getAuthCookie(otherOrg.id))
        .send({ name: "Hacked Booth Type", price: "150.00" });
      expect(updateOther.status).toBe(404);
      expect(updateOther.body.error.code).toBe("NOT_FOUND");

      // Other organizer tries delete -> 404
      const deleteOther = await request(app)
        .delete(`/api/organizer/events/${event.id}/booth-types/${typeId}`)
        .set("Cookie", getAuthCookie(otherOrg.id));
      expect(deleteOther.status).toBe(404);
      expect(deleteOther.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 for vendor and 401 for anonymous on organizer booth-type endpoints", async () => {
      // Vendor gets 403
      const vendorList = await request(app)
        .get(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.vendor.id));
      expect(vendorList.status).toBe(403);
      expect(vendorList.body.error.code).toBe("FORBIDDEN");

      const vendorCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.vendor.id))
        .send({ name: "Vendor Booth Type", price: "100.00" });
      expect(vendorCreate.status).toBe(403);
      expect(vendorCreate.body.error.code).toBe("FORBIDDEN");

      // Anonymous gets 401
      const anonList = await request(app)
        .get(`/api/organizer/events/${event.id}/booth-types`);
      expect(anonList.status).toBe(401);
      expect(anonList.body.error.code).toBe("UNAUTHORIZED");

      const anonCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .send({ name: "Anon Booth Type", price: "100.00" });
      expect(anonCreate.status).toBe(401);
      expect(anonCreate.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Validation Errors (400 VALIDATION_ERROR)", () => {
    it("rejects negative price", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Negative Price", price: "-10.00" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects negative physical dimensions", async () => {
      const resWidth = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Bad Width", price: "100.00", physicalWidth: "-1.00" });
      expect(resWidth.status).toBe(400);
      expect(resWidth.body.error.code).toBe("VALIDATION_ERROR");

      const resLength = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Bad Length", price: "100.00", physicalLength: "-2.00" });
      expect(resLength.status).toBe(400);
      expect(resLength.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unknown extra key (strict schema)", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Extra Field", price: "100.00", rogueProperty: "danger" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects name exceeding 100 characters", async () => {
      const res = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "B".repeat(101), price: "100.00" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects empty name or whitespace-only name", async () => {
      const res1 = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "", price: "100.00" });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("VALIDATION_ERROR");

      const res2 = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "   ", price: "100.00" });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Duplicate Name Conflict (409 CONFLICT)", () => {
    it("returns 409 CONFLICT on duplicate booth type name on create and update", async () => {
      // Create first booth type
      const res1 = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Standard", price: "200.00" });
      expect(res1.status).toBe(201);

      // Create duplicate name -> 409
      const resDup = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Standard", price: "300.00" });
      expect(resDup.status).toBe(409);
      expect(resDup.body.error.code).toBe("CONFLICT");

      // Create second distinct booth type
      const res2 = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Premium", price: "500.00" });
      expect(res2.status).toBe(201);

      // Update second booth type to duplicate first name -> 409
      const resUpdateDup = await request(app)
        .put(`/api/organizer/events/${event.id}/booth-types/${res2.body.id}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Standard", price: "500.00" });
      expect(resUpdateDup.status).toBe(409);
      expect(resUpdateDup.body.error.code).toBe("CONFLICT");
    });
  });

  describe("Booth Integration with boothTypeId", () => {
    it("booth create and update with boothTypeId of the same event works, another event returns 400 BAD_REQUEST, null clears it", async () => {
      // Create booth type in event
      const btRes = await request(app)
        .post(`/api/organizer/events/${event.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Deluxe Type", price: "450.00", physicalWidth: "3.5", physicalLength: "3.5" });
      expect(btRes.status).toBe(201);
      const boothTypeId = btRes.body.id;

      // Create another event and booth type in that other event
      const otherEvent = await createTestEvent(users.org.id);
      const otherBtRes = await request(app)
        .post(`/api/organizer/events/${otherEvent.id}/booth-types`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ name: "Other Event Type", price: "600.00" });
      expect(otherBtRes.status).toBe(201);
      const otherBoothTypeId = otherBtRes.body.id;

      // 1. Create booth with valid boothTypeId -> 201 and response includes boothTypeId
      const createBoothRes = await request(app)
        .post(`/api/organizer/events/${event.id}/booths`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          code: "BT-101",
          price: 450,
          boothTypeId
        });
      expect(createBoothRes.status).toBe(201);
      expect(createBoothRes.body.boothTypeId).toBe(boothTypeId);
      const boothId = createBoothRes.body.id;

      // 2. Create booth with boothTypeId from ANOTHER event -> 400 BAD_REQUEST
      const crossEventCreate = await request(app)
        .post(`/api/organizer/events/${event.id}/booths`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({
          code: "BT-CROSS",
          price: 500,
          boothTypeId: otherBoothTypeId
        });
      expect(crossEventCreate.status).toBe(400);
      expect(crossEventCreate.body.error.code).toBe("BAD_REQUEST");
      expect(crossEventCreate.body.error.message).toBe("Booth type not found in this event");

      // 3. Update booth with boothTypeId from ANOTHER event -> 400 BAD_REQUEST
      const crossEventUpdate = await request(app)
        .patch(`/api/organizer/events/${event.id}/booths/${boothId}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ boothTypeId: otherBoothTypeId });
      expect(crossEventUpdate.status).toBe(400);
      expect(crossEventUpdate.body.error.code).toBe("BAD_REQUEST");
      expect(crossEventUpdate.body.error.message).toBe("Booth type not found in this event");

      // 4. Update booth with null boothTypeId clears it -> 200 and boothTypeId is null
      const clearBtUpdate = await request(app)
        .patch(`/api/organizer/events/${event.id}/booths/${boothId}`)
        .set("Cookie", getAuthCookie(users.org.id))
        .send({ boothTypeId: null });
      expect(clearBtUpdate.status).toBe(200);
      expect(clearBtUpdate.body.boothTypeId).toBeNull();

      // Check DB directly
      const dbBooth = await db.booth.findUnique({ where: { id: boothId } });
      expect(dbBooth?.boothTypeId).toBeNull();
    });

    it("deleting a booth type sets booth.boothTypeId to null and keeps the booth price", async () => {
      // Create booth type with price 250
      const bt = await db.boothType.create({
        data: {
          eventId: event.id,
          name: "Temporary Type",
          price: "250.00"
        }
      });

      // Create booth referencing this booth type
      const booth = await db.booth.create({
        data: {
          eventId: event.id,
          code: "TEMP-1",
          price: "250.00",
          status: "AVAILABLE",
          boothTypeId: bt.id
        }
      });

      expect(booth.boothTypeId).toBe(bt.id);

      // Delete booth type via API
      const delRes = await request(app)
        .delete(`/api/organizer/events/${event.id}/booth-types/${bt.id}`)
        .set("Cookie", getAuthCookie(users.org.id));
      expect(delRes.status).toBe(204);

      // Verify DB booth: boothTypeId is null, price is still 250
      const updatedBooth = await db.booth.findUnique({ where: { id: booth.id } });
      expect(updatedBooth?.boothTypeId).toBeNull();
      expect(updatedBooth?.price.toString()).toBe("250");
    });

    it("the vendor and anonymous booth list shape is unchanged (exact 12 keys for authenticated, anonymous DTO keys) and does NOT include boothTypeId", async () => {
      // Create booth type and booth with boothTypeId
      const bt = await db.boothType.create({
        data: { eventId: event.id, name: "Shape Check Type", price: "120.00" }
      });
      await db.booth.create({
        data: {
          eventId: event.id,
          code: "SHAPE-1",
          price: "120.00",
          status: "AVAILABLE",
          boothTypeId: bt.id,
          x: 10,
          y: 20,
          width: 2,
          height: 2,
          rotation: 0
        }
      });

      // 1. Authenticated vendor: GET /api/events/:id/booths
      const vendorRes = await request(app)
        .get(`/api/events/${event.id}/booths`)
        .set("Cookie", getAuthCookie(users.vendor.id));
      expect(vendorRes.status).toBe(200);
      expect(vendorRes.body.length).toBeGreaterThan(0);

      const expectedVendorKeys = [
        "code", "height", "id", "physicalLength", "physicalWidth",
        "price", "rotation", "status", "width", "x", "y", "zoneId"
      ].sort();

      for (const b of vendorRes.body) {
        expect(Object.keys(b).sort()).toEqual(expectedVendorKeys);
        expect(b).not.toHaveProperty("boothTypeId");
      }

      // 2. Anonymous: GET /api/events/:id/booths
      const anonRes = await request(app)
        .get(`/api/events/${event.id}/booths`);
      expect(anonRes.status).toBe(200);
      expect(anonRes.body.length).toBeGreaterThan(0);

      const expectedAnonKeys = [
        "code", "height", "productType", "rotation", "status",
        "storeName", "width", "x", "y", "zoneId"
      ].sort();

      for (const b of anonRes.body) {
        expect(Object.keys(b).sort()).toEqual(expectedAnonKeys);
        expect(b).not.toHaveProperty("boothTypeId");
      }
    });
  });
});
