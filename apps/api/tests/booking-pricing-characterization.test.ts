import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";

const app = createApp({ loginRateLimit: false, registerRateLimit: false });

const VALID_SLIP_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("Booking Pricing & Payment Amount Characterization", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should sum booth prices into totalAmount and preserve each item price on booking creation", async () => {
    const { vendor, org } = await createTestUsers();
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: vendor.email, password: "password123" });
    const vendorCookie = loginRes.headers["set-cookie"];

    const event = await createTestEvent(org.id, 3);
    const booth1 = await db.booth.create({
      data: { eventId: event.id, code: "B1", price: 100, status: "AVAILABLE" }
    });
    const booth2 = await db.booth.create({
      data: { eventId: event.id, code: "B2", price: "250.50", status: "AVAILABLE" }
    });

    const res = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", vendorCookie)
      .send({ eventId: event.id, boothIds: [booth1.id, booth2.id] });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe("350.5");
    expect(res.body.items).toHaveLength(2);

    const item1 = res.body.items.find((i: { boothId: string; price: string }) => i.boothId === booth1.id);
    const item2 = res.body.items.find((i: { boothId: string; price: string }) => i.boothId === booth2.id);
    expect(item1?.price).toBe("100");
    expect(item2?.price).toBe("250.5");
  });

  it("should set Payment.amount equal to booking totalAmount after POST /api/vendor/bookings/:id/payments", async () => {
    const { vendor, org } = await createTestUsers();
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: vendor.email, password: "password123" });
    const vendorCookie = loginRes.headers["set-cookie"];

    const event = await createTestEvent(org.id, 3);
    const booth1 = await db.booth.create({
      data: { eventId: event.id, code: "B1", price: 100, status: "AVAILABLE" }
    });
    const booth2 = await db.booth.create({
      data: { eventId: event.id, code: "B2", price: "250.50", status: "AVAILABLE" }
    });

    const bookRes = await request(app)
      .post("/api/vendor/bookings")
      .set("Cookie", vendorCookie)
      .send({ eventId: event.id, boothIds: [booth1.id, booth2.id] });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.totalAmount).toBe("350.5");

    const payRes = await request(app)
      .post(`/api/vendor/bookings/${bookRes.body.id}/payments`)
      .set("Cookie", vendorCookie)
      .send({ slipImage: VALID_SLIP_IMAGE });
    expect(payRes.status).toBe(201);
    expect(payRes.body.amount).toBe("350.5");

    const dbBooking = await db.booking.findUnique({ where: { id: bookRes.body.id } });
    const dbPayment = await db.payment.findUnique({ where: { id: payRes.body.id } });

    expect(dbBooking).not.toBeNull();
    expect(dbPayment).not.toBeNull();
    expect(dbPayment!.amount.toString()).toBe("350.5");
    expect(dbPayment!.amount.toString()).toBe(dbBooking!.totalAmount.toString());
    expect(dbPayment!.amount.equals(dbBooking!.totalAmount)).toBe(true);
  });
});
