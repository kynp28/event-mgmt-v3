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

  // Create payment and update booking status in transaction
  return db.$transaction(async (tx) => {
    // Re-check lock
    const currentBooking = await tx.booking.findFirst({
      where: { id: bookingId }
    });
    if (!currentBooking || currentBooking.status !== "PAYMENT_PENDING") {
      throw new AppError(400, "BAD_REQUEST", "Booking is no longer pending payment");
    }

    const payment = await tx.payment.create({
      data: {
        bookingId,
        amount: currentBooking.totalAmount,
        slipImage: data.slipImage,
        status: "PENDING"
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "PENDING_VERIFICATION"
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
    // Re-check payment status
    const currentPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });

    if (currentPayment!.status !== "PENDING" || currentPayment!.booking.status !== "PENDING_VERIFICATION") {
      throw new AppError(409, "CONFLICT", "Payment or Booking has already been processed");
    }

    if (data.status === "APPROVED") {
      // 1. Update Payment
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "APPROVED",
          verifiedById: organizerId,
          verifiedAt: new Date()
        }
      });

      // 2. Update Booking
      await tx.booking.update({
        where: { id: payment.booking.id },
        data: { status: "CONFIRMED" }
      });

      // 3. Update Booths
      const boothIds = payment.booking.items.map(i => i.boothId);
      await tx.booth.updateMany({
        where: { id: { in: boothIds } },
        data: { status: "BOOKED" }
      });

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
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "REJECTED",
          rejectionReason: data.rejectionReason,
          verifiedById: organizerId,
          verifiedAt: new Date()
        }
      });

      const newRejectionCount = payment.booking.rejectionCount + 1;

      if (newRejectionCount < 2) {
        // Back to PAYMENT_PENDING with new hold
        const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // +30 mins
        await tx.booking.update({
          where: { id: payment.booking.id },
          data: {
            status: "PAYMENT_PENDING",
            rejectionCount: newRejectionCount,
            holdExpiresAt
          }
        });
        return { status: "REJECTED", result: "PENDING_RETRY" };
      } else {
        // Cancelled
        await tx.booking.update({
          where: { id: payment.booking.id },
          data: {
            status: "CANCELLED",
            rejectionCount: newRejectionCount
          }
        });

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
