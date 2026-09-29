import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";
import { createBooking } from "../src/services/booking.service";
import { AppError } from "../src/utils/AppError";

describe("Vendor Quota Concurrency", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should prevent vendor from exceeding maxBoothsPerVendor with concurrent requests", async () => {
    const { vendor, org } = await createTestUsers();
    // maxBoothsPerVendor = 2
    const event = await createTestEvent(org.id, 2);
    
    // Create 3 separate booths
    const b1 = await db.booth.create({ data: { eventId: event.id, code: "Q1", price: 100 } });
    const b2 = await db.booth.create({ data: { eventId: event.id, code: "Q2", price: 100 } });
    const b3 = await db.booth.create({ data: { eventId: event.id, code: "Q3", price: 100 } });

    // Fire 3 concurrent requests, each booking 1 booth
    const promises = [
      createBooking(vendor.id, { eventId: event.id, boothIds: [b1.id] }),
      createBooking(vendor.id, { eventId: event.id, boothIds: [b2.id] }),
      createBooking(vendor.id, { eventId: event.id, boothIds: [b3.id] })
    ];

    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let limitExceededCount = 0;

    for (const res of results) {
      if (res.status === "fulfilled") {
        successCount++;
      } else {
        if (res.reason instanceof AppError && res.reason.code === "LIMIT_EXCEEDED") {
          limitExceededCount++;
        }
      }
    }

    // Since max is 2, only 2 should succeed, 1 should fail with limit exceeded.
    expect(successCount).toBe(2);
    expect(limitExceededCount).toBe(1);

    // Verify DB state
    const items = await db.bookingItem.count({ where: { booking: { vendorId: vendor.id } } });
    expect(items).toBe(2);
  });

  it("should count existing booked booths towards quota and block new requests (1 booking with 2 booths, then 1 new booth)", async () => {
    const { vendor, org } = await createTestUsers();
    // maxBoothsPerVendor = 2
    const event = await createTestEvent(org.id, 2);
    
    const b1 = await db.booth.create({ data: { eventId: event.id, code: "Q4", price: 100 } });
    const b2 = await db.booth.create({ data: { eventId: event.id, code: "Q5", price: 100 } });
    const b3 = await db.booth.create({ data: { eventId: event.id, code: "Q6", price: 100 } });

    // First booking has 2 booths (hitting the limit)
    await createBooking(vendor.id, { eventId: event.id, boothIds: [b1.id, b2.id] });

    // Second booking asks for 1 more booth -> MUST fail with 400 LIMIT_EXCEEDED
    await expect(
      createBooking(vendor.id, { eventId: event.id, boothIds: [b3.id] })
    ).rejects.toThrowError(/Maximum 2 booths allowed per vendor/i);
  });
});
