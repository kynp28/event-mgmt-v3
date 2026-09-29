import { db } from "../lib/db";
import { AppError } from "../utils/AppError";

export async function getMyTicket(bookingId: string, vendorId: string) {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, vendorId },
    include: {
      event: true,
      items: { include: { booth: true } },
      ticket: true
    }
  });

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.status !== "CONFIRMED") throw new AppError(400, "INVALID_TICKET", "Booking is not confirmed yet");
  if (!booking.ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found for this booking");

  return booking;
}

export async function checkIn(token: string, organizerId: string) {
  const ticket = await db.ticket.findUnique({
    where: { token },
    include: {
      booking: { include: { items: { include: { booth: true } }, vendor: true } },
      event: true
    }
  });

  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  if (ticket.event.organizerId !== organizerId) throw new AppError(403, "FORBIDDEN", "You don't own this event");
  if (ticket.booking.status !== "CONFIRMED") throw new AppError(400, "INVALID_TICKET", "Booking is not confirmed");
  
  if (ticket.checkedInAt) {
    throw new AppError(
      409, 
      "ALREADY_CHECKED_IN", 
      `Checked in at ${ticket.checkedInAt.toISOString()} by ${ticket.checkedInBy}`
    );
  }

  // Atomic update to prevent double-scan concurrency
  const updateRes = await db.ticket.updateMany({
    where: { id: ticket.id, checkedInAt: null },
    data: {
      checkedInAt: new Date(),
      checkedInBy: organizerId
    }
  });

  if (updateRes.count === 0) {
    // It was checked in by someone else concurrently between our read and update
    const reFetched = await db.ticket.findUnique({ where: { id: ticket.id } });
    throw new AppError(
      409, 
      "ALREADY_CHECKED_IN", 
      `Checked in at ${reFetched?.checkedInAt?.toISOString()} by ${reFetched?.checkedInBy}`
    );
  }

  return {
    vendorName: ticket.booking.vendor.name,
    vendorEmail: ticket.booking.vendor.email,
    booths: ticket.booking.items.map(i => i.booth.code).join(", ")
  };
}
