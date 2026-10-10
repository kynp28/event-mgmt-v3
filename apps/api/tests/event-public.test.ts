import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";

const app = createApp({ loginRateLimit: false, registerRateLimit: false });

describe("Feature B: Public Pages API", () => {
  let users: Awaited<ReturnType<typeof createTestUsers>>;
  let cookies: Record<string, string[]> = {};
  
  let pubEventId: string;
  let draftEventId: string;
  let closedEventId: string;

  beforeAll(async () => {
    await clearDb();
    users = await createTestUsers();

    for (const [key, email] of [
      ["admin", users.admin.email],
      ["org", users.org.email],
      ["vendor", users.vendor.email]
    ]) {
      const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
      cookies[key] = res.headers["set-cookie"];
    }

    const pubEvent = await createTestEvent(users.org.id);
    pubEventId = pubEvent.id;

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
  });

  describe("Event List & Detail", () => {
    it("DRAFT: detail -> 404 and absent from list for anonymous and VENDOR", async () => {
      // List
      const listRes = await request(app).get("/api/events");
      expect(listRes.body.map((e: any) => e.id)).not.toContain(draftEventId);

      const listVendor = await request(app).get("/api/events").set("Cookie", cookies.vendor);
      expect(listVendor.body.map((e: any) => e.id)).not.toContain(draftEventId);

      // Detail
      const detRes = await request(app).get(`/api/events/${draftEventId}`);
      expect(detRes.status).toBe(404);

      const detVendor = await request(app).get(`/api/events/${draftEventId}`).set("Cookie", cookies.vendor);
      expect(detVendor.status).toBe(404);
    });

    it("CLOSED: present in list, detail -> 200", async () => {
      const listRes = await request(app).get("/api/events");
      expect(listRes.body.map((e: any) => e.id)).toContain(closedEventId);

      const detRes = await request(app).get(`/api/events/${closedEventId}`);
      expect(detRes.status).toBe(200);
      expect(detRes.body.id).toBe(closedEventId);
    });
  });

  describe("Public Booths", () => {
    let bookedConfirmedBoothId: string;
    let paymentPendingBoothId: string;
    let disabledBoothId: string;
    let twoConfirmedBoothId: string;

    beforeAll(async () => {
      // Create some booths in the CLOSED event for public viewing
      const b1 = await db.booth.create({ data: { eventId: closedEventId, code: "AVAILABLE1", price: 100, status: "AVAILABLE" } });
      const b2 = await db.booth.create({ data: { eventId: closedEventId, code: "BOOKED1", price: 100, status: "BOOKED" } });
      const b3 = await db.booth.create({ data: { eventId: closedEventId, code: "PENDING1", price: 100, status: "PAYMENT_PENDING" } });
      const b4 = await db.booth.create({ data: { eventId: closedEventId, code: "DISABLED1", price: 100, status: "DISABLED" } });
      const b5 = await db.booth.create({ data: { eventId: closedEventId, code: "TWOCONF1", price: 100, status: "BOOKED" } });
      const b6 = await db.booth.create({ data: { eventId: closedEventId, code: "BOOKED_NOPROF", price: 100, status: "BOOKED" } });

      bookedConfirmedBoothId = b2.id;
      paymentPendingBoothId = b3.id;
      disabledBoothId = b4.id;
      twoConfirmedBoothId = b5.id;

      // Vendor with profile for BOOKED1
      const vendor1 = await db.user.create({
        data: {
          email: "vendor_p1@test.com", password: "pwd", role: "VENDOR",
          vendorProfile: { create: { storeName: "Store 1", productType: "Type 1" } }
        }
      });
      const book1 = await db.booking.create({
        data: {
          vendorId: vendor1.id, eventId: closedEventId, status: "CONFIRMED", totalAmount: 100,
          items: { create: { boothId: b2.id, price: 100 } }
        }
      });

      // PAYMENT_PENDING1
      const book2 = await db.booking.create({
        data: {
          vendorId: vendor1.id, eventId: closedEventId, status: "PAYMENT_PENDING", totalAmount: 100,
          items: { create: { boothId: b3.id, price: 100 } }
        }
      });

      // Vendor WITHOUT profile for TWOCONF1 (first booking)
      const vendor2 = await db.user.create({
        data: { email: "vendor_np2@test.com", password: "pwd", role: "VENDOR" }
      });
      const vendorOld = await db.user.create({
        data: {
          email: "vendor_old@test.com", password: "pwd", role: "VENDOR",
          vendorProfile: { create: { storeName: "Store Old", productType: "Type Old" } }
        }
      });
      await db.booking.create({
        data: {
          vendorId: vendor2.id, eventId: closedEventId, status: "CONFIRMED", totalAmount: 100,
          items: { create: { boothId: b6.id, price: 100 } }
        }
      });
      await db.booking.create({
        data: {
          vendorId: vendorOld.id, eventId: closedEventId, status: "CONFIRMED", totalAmount: 100,
          createdAt: new Date(Date.now() - 10000), // Older
          items: { create: { boothId: b5.id, price: 100 } }
        }
      });

      // Vendor WITH profile for TWOCONF1 (second booking, latest)
      const vendor3 = await db.user.create({
        data: {
          email: "vendor_p3@test.com", password: "pwd", role: "VENDOR",
          vendorProfile: { create: { storeName: "Store 3", productType: "Type 3" } }
        }
      });
      await db.booking.create({
        data: {
          vendorId: vendor3.id, eventId: closedEventId, status: "CONFIRMED", totalAmount: 100,
          createdAt: new Date(), // Newer
          items: { create: { boothId: b5.id, price: 100 } }
        }
      });
      
      // Add PUBLISHED booth
      await db.booth.create({ data: { eventId: pubEventId, code: "PUB1", price: 100, status: "AVAILABLE" } });
      // Also add a DRAFT booth just in case
      await db.booth.create({ data: { eventId: draftEventId, code: "D1", price: 100, status: "AVAILABLE" } });
    });

    it("DRAFT booths -> 404 for anonymous, 200 for ORGANIZER(owner)/ADMIN", async () => {
      const anonRes = await request(app).get(`/api/events/${draftEventId}/booths`);
      expect(anonRes.status).toBe(404);

      const orgRes = await request(app).get(`/api/events/${draftEventId}/booths`).set("Cookie", cookies.org);
      expect(orgRes.status).toBe(200);

      const adminRes = await request(app).get(`/api/events/${draftEventId}/booths`).set("Cookie", cookies.admin);
      expect(adminRes.status).toBe(200);
    });

    it("CLOSED booths -> 200 for anonymous (public DTO), 404 for VENDOR", async () => {
      const anonRes = await request(app).get(`/api/events/${closedEventId}/booths`);
      expect(anonRes.status).toBe(200);

      const vendorRes = await request(app).get(`/api/events/${closedEventId}/booths`).set("Cookie", cookies.vendor);
      expect(vendorRes.status).toBe(404);
    });

    it("Public DTO exact key set, no price/id/email in raw JSON", async () => {
      const res = await request(app).get(`/api/events/${closedEventId}/booths`);
      const booths = res.body;

      const expectedKeys = ["code", "zoneId", "x", "y", "width", "height", "rotation", "status", "storeName", "productType"].sort();

      for (const b of booths) {
        expect(Object.keys(b).sort()).toEqual(expectedKeys);
      }

      const rawJson = JSON.stringify(booths);
      expect(rawJson).not.toContain('"id":');
      expect(rawJson).not.toContain('"price"');
      expect(rawJson).not.toContain('@test.com');
    });

    it("BOOKED + CONFIRMED booth shows storeName/productType, PAYMENT_PENDING/DISABLED -> RESERVED", async () => {
      const res = await request(app).get(`/api/events/${closedEventId}/booths`);
      const booths = res.body;

      const bBooked = booths.find((b: any) => b.code === "BOOKED1");
      expect(bBooked.status).toBe("BOOKED");
      expect(bBooked.storeName).toBe("Store 1");
      expect(bBooked.productType).toBe("Type 1");

      const bPending = booths.find((b: any) => b.code === "PENDING1");
      expect(bPending.status).toBe("RESERVED");
      expect(bPending.storeName).toBeNull();
      expect(bPending.productType).toBeNull();

      const bDisabled = booths.find((b: any) => b.code === "DISABLED1");
      expect(bDisabled.status).toBe("RESERVED");
      expect(bDisabled.storeName).toBeNull();
      expect(bDisabled.productType).toBeNull();

      const bTwoConf = booths.find((b: any) => b.code === "TWOCONF1");
      expect(bTwoConf.status).toBe("BOOKED");
      expect(bTwoConf.storeName).toBe("Store 3"); // the latest one
      expect(bTwoConf.productType).toBe("Type 3");

      const bNoProf = booths.find((b: any) => b.code === "BOOKED_NOPROF");
      expect(bNoProf.status).toBe("BOOKED");
      expect(bNoProf.storeName).toBeNull();
      expect(bNoProf.productType).toBeNull();
    });

    it("Cookie handling: invalid/unapproved token -> treated as anonymous", async () => {
      // Create an unapproved organizer
      const unapprovedOrg = await db.user.create({
        data: {
          email: "unapproved@org.com", password: "pwd", role: "ORGANIZER",
          organizerProfile: { create: { companyName: "U", status: "PENDING" } }
        }
      });
      const unapprovedCookie = [`token=${jwt.sign({ userId: unapprovedOrg.id }, process.env.JWT_SECRET!)}`];
      
      // Should get public DTO, not 401/403
      const res1 = await request(app).get(`/api/events/${closedEventId}/booths`).set("Cookie", unapprovedCookie);
      expect(res1.status).toBe(200);
      expect(Object.keys(res1.body[0])).not.toContain("price");
      expect(Object.keys(res1.body[0])).not.toContain("id"); // public DTO

      const res2 = await request(app).get(`/api/events/${closedEventId}/booths`).set("Cookie", ["token=invalid"]);
      expect(res2.status).toBe(200);
      expect(Object.keys(res2.body[0])).not.toContain("price"); // public DTO

      // Valid VENDOR on PUBLISHED gets full DTO
      const res3 = await request(app).get(`/api/events/${pubEventId}/booths`).set("Cookie", cookies.vendor);
      expect(res3.status).toBe(200);
      expect(Array.isArray(res3.body)).toBe(true);
      const expectedFullKeys = ["id", "code", "price", "status", "physicalLength", "physicalWidth", "x", "y", "width", "height", "rotation", "zoneId"].sort();
      expect(Object.keys(res3.body[0]).sort()).toEqual(expectedFullKeys);
    });

    it("PUBLISHED booths -> 200 for anonymous with public DTO", async () => {
      const res = await request(app).get(`/api/events/${pubEventId}/booths`);
      expect(res.status).toBe(200);
      const pub1 = res.body.find((b: any) => b.code === "PUB1");
      expect(pub1).toBeDefined();
      expect(pub1.status).toBe("AVAILABLE");
      expect(Object.keys(pub1)).not.toContain("id");
      expect(Object.keys(pub1)).not.toContain("price");
    });
  });
});
