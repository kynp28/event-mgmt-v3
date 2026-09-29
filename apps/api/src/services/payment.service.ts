import { db } from "../lib/db";
import { Prisma } from "@prisma/client";
import { UploadSlipPayload, VerifyPaymentPayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";
export async function getPaymentsByEvent(eventId: string, organizerId: string) {
  // verify ownership
  const event = await db.event.findFirst({ where: { id: eventId, organizerId } });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found");
  return db.payment.findMany({
    where: {
      booking: { eventId }
    },
    include: {
      booking: { include: { vendor: { select: { name: true, email: true } }, items: { include: { booth: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
}
export async function uploadSlip(bookingId: string, vendorId: string, data: UploadSlipPayload) {
  // Verify ownership
  const booking = await db.booking.findFirst({
    where: { id: bookingId, vendorId }
  });
  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found or not owned by you");
  if (booking.status !== "PAYMENT_PENDING") {
    throw new AppError(400, "BAD_REQUEST", "Booking is not in PAYMENT_PENDING status");
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    throw new AppError(400, "BAD_REQUEST", "Booking hold has expired");
  }
  // Create payment and update booking status in transaction
  return db.$transaction(async (tx) => {
    const updateRes = await tx.booking.updateMany({
      where: { 
        id: bookingId, 
        status: "PAYMENT_PENDING",
        holdExpiresAt: { gt: new Date() }
      },
      data: {
        status: "PENDING_VERIFICATION"
      }
    });
    if (updateRes.count !== 1) {
      throw new AppError(400, "BAD_REQUEST", "Booking is no longer pending payment or hold has expired");
    }
    const payment = await tx.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        slipImage: data.slipImage,
        status: "PENDING"
      }
    });
    return payment;
  });
}
export async function verifyPayment(paymentId: string, organizerId: string, data: VerifyPaymentPayload) {
  // Organizer must own the event the booking belongs to
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: { event: true, items: true }
      }
    }
  });
  if (!payment) throw new AppError(404, "NOT_FOUND", "Payment not found");
  if (payment.booking.event.organizerId !== organizerId) {
    throw new AppError(403, "FORBIDDEN", "You do not own this event");
  }
  if (payment.status !== "PENDING") {
    throw new AppError(400, "BAD_REQUEST", "Payment is already processed");
  }
  return db.$transaction(async (tx) => {
    if (data.status === "APPROVED") {
      // 1. Update Payment
      const payUpdate = await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: {
          status: "APPROVED",
          verifiedById: organizerId,
          verifiedAt: new Date()
        }
      });
      if (payUpdate.count !== 1) throw new AppError(409, "CONFLICT", "Payment has already been processed");
      // 2. Update Booking
      const bookUpdate = await tx.booking.updateMany({
        where: { id: payment.booking.id, status: "PENDING_VERIFICATION" },
        data: { status: "CONFIRMED" }
      });
      if (bookUpdate.count !== 1) throw new AppError(409, "CONFLICT", "Booking has already been processed");
      // 3. Update Booths
      const boothIds = payment.booking.items.map(i => i.boothId);
      const boothUpdate = await tx.booth.updateMany({
        where: { id: { in: boothIds }, status: "PAYMENT_PENDING" },
        data: { status: "BOOKED" }
      });
      if (boothUpdate.count !== boothIds.length) {
        throw new AppError(409, "CONFLICT", "One or more booths are no longer in PAYMENT_PENDING state");
      }
      // 4. Create Ticket
      await tx.ticket.create({
        data: {
          bookingId: payment.booking.id,
          eventId: payment.booking.eventId,
          userId: payment.booking.vendorId
        }
      });
      return { status: "APPROVED" };
    } else {
      // REJECTED
      // 1. Update Payment
      const payUpdate = await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: {
          status: "REJECTED",
          rejectionReason: data.rejectionReason,
          verifiedById: organizerId,
          verifiedAt: new Date()
        }
      });
      if (payUpdate.count !== 1) throw new AppError(409, "CONFLICT", "Payment has already been processed");
      // Read current booking inside tx to get accurate rejectionCount
      const currentBooking = await tx.booking.findUnique({
        where: { id: payment.booking.id }
      });
      
      if (!currentBooking || currentBooking.status !== "PENDING_VERIFICATION") {
        throw new AppError(409, "CONFLICT", "Booking has already been processed");
      }
      const newRejectionCount = currentBooking.rejectionCount + 1;
      if (newRejectionCount < 2) {
        // Back to PAYMENT_PENDING with new hold
        const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // +30 mins
        const bookUpdate = await tx.booking.updateMany({
          where: { id: payment.booking.id, status: "PENDING_VERIFICATION" },
          data: {
            status: "PAYMENT_PENDING",
            rejectionCount: newRejectionCount,
            holdExpiresAt
          }
        });
        if (bookUpdate.count !== 1) throw new AppError(409, "CONFLICT", "Booking has already been processed");
        
        return { status: "REJECTED", result: "PENDING_RETRY" };
      } else {
        // Cancelled
        const bookUpdate = await tx.booking.updateMany({
          where: { id: payment.booking.id, status: "PENDING_VERIFICATION" },
          data: {
            status: "CANCELLED",
            rejectionCount: newRejectionCount
          }
        });
        if (bookUpdate.count !== 1) throw new AppError(409, "CONFLICT", "Booking has already been processed");
        // Release Booths
        const boothIds = payment.booking.items.map(i => i.boothId);
        await tx.booth.updateMany({
          where: { id: { in: boothIds } },
          data: { status: "AVAILABLE" }
        });
        return { status: "REJECTED", result: "CANCELLED" };
      }
    }
  });
}
