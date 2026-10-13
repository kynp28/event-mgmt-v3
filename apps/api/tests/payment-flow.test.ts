import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";
import { createBooking } from "../src/services/booking.service";
import { uploadSlip, verifyPayment } from "../src/services/payment.service";
import { AppError } from "../src/utils/AppError";

describe("Payment Flow", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should reject uploadSlip if holdExpiresAt has passed", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({ data: { eventId: event.id, code: "P1", price: 100 } });

    const booking = await createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] });
    
    // Manually expire the hold
    await db.booking.update({
      where: { id: booking.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) }
    });

    await expect(
      uploadSlip(booking.id, vendor.id, { slipImage: "base64..." })
    ).rejects.toThrowError(/hold has expired/i);
  });

  it("should handle concurrent verifyPayment APPROVED safely (only 1 ticket created)", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({ data: { eventId: event.id, code: "P2", price: 100 } });

    const booking = await createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] });
    const payment = await uploadSlip(booking.id, vendor.id, { slipImage: "base64..." });

    // Fire 2 concurrent verifyPayment APPROVED
    const promises = [
      verifyPayment(payment.id, org.id, { status: "APPROVED" }),
      verifyPayment(payment.id, org.id, { status: "APPROVED" })
    ];

    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let conflictCount = 0;

    for (const res of results) {
      if (res.status === "fulfilled") successCount++;
      else if (res.reason instanceof AppError && res.reason.code === "CONFLICT") conflictCount++;
    }

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // Ensure only 1 ticket exists
    const tickets = await db.ticket.findMany({ where: { bookingId: booking.id } });
    expect(tickets.length).toBe(1);
    
    // Ensure booking is CONFIRMED
    const dbBooking = await db.booking.findUnique({ where: { id: booking.id } });
    expect(dbBooking?.status).toBe("CONFIRMED");
  });

  it("should handle concurrent verifyPayment APPROVED vs REJECTED gracefully", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({ data: { eventId: event.id, code: "P3", price: 100 } });

    const booking = await createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] });
    const payment = await uploadSlip(booking.id, vendor.id, { slipImage: "base64..." });

    // Fire 2 concurrent verifyPayment (one APPROVED, one REJECTED)
    const promises = [
      verifyPayment(payment.id, org.id, { status: "APPROVED" }),
      verifyPayment(payment.id, org.id, { status: "REJECTED", rejectionReason: "Blurry" })
    ];

    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let conflictCount = 0;

    for (const res of results) {
      if (res.status === "fulfilled") successCount++;
      else if (res.reason instanceof AppError && res.reason.code === "CONFLICT") conflictCount++;
    }

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // Assert final consistency
    const dbPayment = await db.payment.findUnique({ where: { id: payment.id } });
    const dbBooking = await db.booking.findUnique({ where: { id: booking.id } });
    const dbBooth = await db.booth.findUnique({ where: { id: booth.id } });

    if (dbPayment?.status === "APPROVED") {
      expect(dbBooking?.status).toBe("CONFIRMED");
      expect(dbBooth?.status).toBe("BOOKED");
      const tickets = await db.ticket.findMany({ where: { bookingId: booking.id } });
      expect(tickets.length).toBe(1);
    } else if (dbPayment?.status === "REJECTED") {
      expect(dbBooking?.status).toBe("PAYMENT_PENDING");
      expect(dbBooking?.rejectionCount).toBe(1);
      expect(dbBooth?.status).toBe("PAYMENT_PENDING");
      const tickets = await db.ticket.findMany({ where: { bookingId: booking.id } });
      expect(tickets.length).toBe(0);
    } else {
      throw new Error("Payment status invalid");
    }
  });
});
