import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db";
import { clearDb, createTestUsers, createTestEvent } from "./helpers";
import { createBooking } from "../src/services/booking.service";
import { uploadSlip, verifyPayment } from "../src/services/payment.service";

describe("State Transitions", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should transition to CANCELLED and free booths on 2nd payment rejection", async () => {
    const { vendor, org } = await createTestUsers();
    const event = await createTestEvent(org.id);
    const booth = await db.booth.create({ data: { eventId: event.id, code: "S1", price: 100 } });

    // 1. Create booking
    const booking = await createBooking(vendor.id, { eventId: event.id, boothIds: [booth.id] });
    
    // 2. First upload and reject
    let payment = await uploadSlip(booking.id, vendor.id, { slipImage: "slip1" });
    let res = await verifyPayment(payment.id, org.id, { status: "REJECTED", rejectionReason: "Blurry" });
    
    expect(res.status).toBe("REJECTED");
    expect(res.result).toBe("PENDING_RETRY");
    
    const b1 = await db.booking.findUnique({ where: { id: booking.id } });
    expect(b1?.status).toBe("PAYMENT_PENDING");
    expect(b1?.rejectionCount).toBe(1);

    // 3. Second upload and reject
    payment = await uploadSlip(booking.id, vendor.id, { slipImage: "slip2" });
    res = await verifyPayment(payment.id, org.id, { status: "REJECTED", rejectionReason: "Fake" });
    
    expect(res.status).toBe("REJECTED");
    expect(res.result).toBe("CANCELLED");

    const b2 = await db.booking.findUnique({ where: { id: booking.id } });
    expect(b2?.status).toBe("CANCELLED");
    expect(b2?.rejectionCount).toBe(2);

    const dbBooth = await db.booth.findUnique({ where: { id: booth.id } });
    expect(dbBooth?.status).toBe("AVAILABLE");
  });
});
