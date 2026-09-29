import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";
import { createBooking, releaseExpiredBookings } from "../src/services/booking.service";
import { AppError } from "../src/utils/AppError";

describe("Booking Hold & Concurrency", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should allow only 1 booking out of 50 concurrent requests for the same booth", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({
      data: { eventId: event.id, code: "C1", price: 100, status: "AVAILABLE" }
    });

    // Create 50 concurrent requests
    const promises = Array.from({ length: 50 }).map(() => 
      createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] })
    );

    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let fail409Count = 0;

    for (const res of results) {
      if (res.status === "fulfilled") {
        successCount++;
      } else {
        if (res.reason instanceof AppError && res.reason.code === "BOOTHS_UNAVAILABLE") {
          fail409Count++;
        }
      }
    }

    expect(successCount).toBe(1);
    expect(fail409Count).toBe(49);

    const dbBooth = await db.booth.findUnique({ where: { id: booth.id } });
    expect(dbBooth?.status).toBe("PAYMENT_PENDING");
  });

  it("should release expired bookings and make booths available", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({
      data: { eventId: event.id, code: "R1", price: 100, status: "AVAILABLE" }
    });

    const booking = await createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] });
    
    // Manually expire the hold
    await db.booking.update({
      where: { id: booking.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) } // past
    });

    const releasedCount = await releaseExpiredBookings();
    expect(releasedCount).toBe(1);

    const updatedBooth = await db.booth.findUnique({ where: { id: booth.id } });
    expect(updatedBooth?.status).toBe("AVAILABLE");

    const updatedBooking = await db.booking.findUnique({ where: { id: booking.id } });
    expect(updatedBooking?.status).toBe("EXPIRED");
  });
});
