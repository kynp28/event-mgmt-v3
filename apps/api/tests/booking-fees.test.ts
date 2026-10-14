import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";

const app = createApp({ loginRateLimit: false, registerRateLimit: false });

const VALID_SLIP_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function getAuthCookie(userId: string): string[] {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!);
  return [`token=${token}`];
}

describe("Booking Fees & Calculation", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("calculates totalAmount and feesSnapshot for booking with PER_BOOKING and PER_BOOTH fees", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const b1 = await db.booth.create({
      data: { eventId: event.id, code: "A1", price: "100.00", status: "AVAILABLE" }
    });
    const b2 = await db.booth.create({
      data: { eventId: event.id, code: "A2", price: "250.50", status: "AVAILABLE" }
    });

    await db.eventFee.create({
      data: { eventId: event.id, name: "Cleaning Fee", type: "PER_BOOKING", amount: "50.00" }
    });
    await db.eventFee.create({
      data: { eventId: event.id, name: "Electricity Fee", type: "PER_BOOTH", amount: "10.25" }
    });

    const res = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [b1.id, b2.id] });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe("421");
    expect(res.body.feesSnapshot).toEqual([
      { name: "Cleaning Fee", type: "PER_BOOKING", amount: "50.00", quantity: 1, subtotal: "50.00" },
      { name: "Electricity Fee", type: "PER_BOOTH", amount: "10.25", quantity: 2, subtotal: "20.50" }
    ]);
  });

  it("sets feesSnapshot to null and totalAmount to booth sum when event has no fees", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const b1 = await db.booth.create({
      data: { eventId: event.id, code: "B1", price: "100.00", status: "AVAILABLE" }
    });
    const b2 = await db.booth.create({
      data: { eventId: event.id, code: "B2", price: "150.00", status: "AVAILABLE" }
    });

    const res = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [b1.id, b2.id] });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe("250");
    expect(res.body.feesSnapshot).toBeNull();
  });

  it("sets Payment.amount equal to totalAmount after uploadSlip for a booking with fees", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const b1 = await db.booth.create({
      data: { eventId: event.id, code: "C1", price: "100.00", status: "AVAILABLE" }
    });
    await db.eventFee.create({
      data: { eventId: event.id, name: "Registration Fee", type: "PER_BOOKING", amount: "50.00" }
    });

    const bookRes = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [b1.id] });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.totalAmount).toBe("150");

    const payRes = await request(app)
      .post(`/api/vendor/bookings/${bookRes.body.id}/payments`)
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ slipImage: VALID_SLIP_IMAGE });
    expect(payRes.status).toBe(201);
    expect(payRes.body.amount).toBe("150");

    const dbPayment = await db.payment.findUnique({ where: { id: payRes.body.id } });
    expect(dbPayment?.amount.toString()).toBe("150");
  });

  it("editing or deleting a fee after booking does NOT change that booking's stored totalAmount or feesSnapshot", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const b1 = await db.booth.create({
      data: { eventId: event.id, code: "D1", price: "100.00", status: "AVAILABLE" }
    });
    const fee1 = await db.eventFee.create({
      data: { eventId: event.id, name: "Initial Fee", type: "PER_BOOKING", amount: "50.00" }
    });

    const bookRes = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [b1.id] });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.totalAmount).toBe("150");

    // Edit fee amount
    await db.eventFee.update({
      where: { id: fee1.id },
      data: { amount: "999.00" }
    });

    let dbBooking = await db.booking.findUnique({ where: { id: bookRes.body.id } });
    expect(dbBooking?.totalAmount.toString()).toBe("150");
    expect(dbBooking?.feesSnapshot).toEqual([
      { name: "Initial Fee", type: "PER_BOOKING", amount: "50.00", quantity: 1, subtotal: "50.00" }
    ]);

    // Delete fee
    await db.eventFee.delete({ where: { id: fee1.id } });

    dbBooking = await db.booking.findUnique({ where: { id: bookRes.body.id } });
    expect(dbBooking?.totalAmount.toString()).toBe("150");
    expect(dbBooking?.feesSnapshot).toEqual([
      { name: "Initial Fee", type: "PER_BOOKING", amount: "50.00", quantity: 1, subtotal: "50.00" }
    ]);
  });

  it("GET /api/vendor/bookings returns feesSnapshot", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const b1 = await db.booth.create({
      data: { eventId: event.id, code: "E1", price: "100.00", status: "AVAILABLE" }
    });
    await db.eventFee.create({
      data: { eventId: event.id, name: "Service Fee", type: "PER_BOOKING", amount: "30.00" }
    });

    await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [b1.id] });

    const listRes = await request(app)
      .get("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id));

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].feesSnapshot).toEqual([
      { name: "Service Fee", type: "PER_BOOKING", amount: "30.00", quantity: 1, subtotal: "30.00" }
    ]);
  });

  it("10 parallel bookings by 10 different vendors on 10 different booths with 2 fees all succeed with correct totalAmount", async () => {
    const { org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    await db.eventFee.create({
      data: { eventId: event.id, name: "Booking Surcharge", type: "PER_BOOKING", amount: "50.00" }
    });
    await db.eventFee.create({
      data: { eventId: event.id, name: "Booth Cleanliness", type: "PER_BOOTH", amount: "10.00" }
    });

    const password = await bcrypt.hash("password123", 10);
    const vendors = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        db.user.create({
          data: { email: `concurrent_vendor_${i}@test.com`, password, role: "VENDOR" }
        })
      )
    );

    const booths = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        db.booth.create({
          data: { eventId: event.id, code: `PAR_${i}`, price: "100.00", status: "AVAILABLE" }
        })
      )
    );

    const results = await Promise.all(
      vendors.map((v, i) =>
        request(app)
          .post("/api/vendor/bookings")
          .set("Cookie", getAuthCookie(v.id))
          .send({ eventId: event.id, boothIds: [booths[i].id] })
      )
    );

    for (const res of results) {
      expect(res.status).toBe(201);
      // 100 + 50 + (10 * 1) = 160
      expect(res.body.totalAmount).toBe("160");
      expect(res.body.feesSnapshot).toHaveLength(2);
    }
  });

  it("a failed booking (booth already taken, 409 BOOTHS_UNAVAILABLE) leaves no booking row and booth status unchanged", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id, 5);

    const booth = await db.booth.create({
      data: { eventId: event.id, code: "F1", price: "100.00", status: "BOOKED" }
    });
    await db.eventFee.create({
      data: { eventId: event.id, name: "Fee", type: "PER_BOOKING", amount: "20.00" }
    });

    const res = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", getAuthCookie(vendor.id))
      .send({ eventId: event.id, boothIds: [booth.id] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOTHS_UNAVAILABLE");

    const bookingCount = await db.booking.count({ where: { eventId: event.id } });
    expect(bookingCount).toBe(0);

    const dbBooth = await db.booth.findUnique({ where: { id: booth.id } });
    expect(dbBooth?.status).toBe("BOOKED");
  });
});
