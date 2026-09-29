import { db } from "../lib/db";
import { Prisma } from "@prisma/client";
import { CreateBookingPayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";
export async function getMyBookings(vendorId: string) {
  return db.booking.findMany({
    where: { vendorId },
    include: {
      event: true,
      items: { include: { booth: true } },
      payments: true,
      ticket: true
    },
    orderBy: { createdAt: "desc" }
  });
}
export async function createBooking(vendorId: string, data: CreateBookingPayload) {
  const event = await db.event.findUnique({ where: { id: data.eventId } });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found");
  // Ensure boothIds are unique and sorted ascending to prevent deadlocks
  const uniqueBoothIds = Array.from(new Set(data.boothIds)).sort();
  let attempt = 0;
  while (attempt < 2) {
    try {
      return await db.$transaction(async (tx) => {
        // 0. Lock vendor to prevent concurrent quota bypass
        await tx.$queryRaw`SELECT id FROM User WHERE id = ${vendorId} FOR UPDATE`;
        const activeBoothCount = await tx.bookingItem.count({
          where: {
            booking: {
              eventId: data.eventId,
              vendorId,
              status: { in: ["PAYMENT_PENDING", "PENDING_VERIFICATION", "CONFIRMED"] }
            }
          }
        });
        if (activeBoothCount + uniqueBoothIds.length > event.maxBoothsPerVendor) {
          throw new AppError(400, "LIMIT_EXCEEDED", `Maximum ${event.maxBoothsPerVendor} booths allowed per vendor for this event.`);
        }
        // 1. Lock/select the target booths in ASCENDING id order
        await tx.$queryRaw`
          SELECT id, price FROM Booth 
          WHERE id IN (${Prisma.join(uniqueBoothIds)}) 
          ORDER BY id ASC FOR UPDATE
        `;
        // 2. Atomic updateMany to hold
        const updateRes = await tx.booth.updateMany({
          where: {
            id: { in: uniqueBoothIds },
            status: "AVAILABLE",
            eventId: data.eventId
          },
          data: {
            status: "PAYMENT_PENDING"
          }
        });
        if (updateRes.count !== uniqueBoothIds.length) {
          throw new AppError(409, "BOOTHS_UNAVAILABLE", "One or more booths are no longer available");
        }
        // Fetch prices (we can just fetch them normally since they are locked)
        const booths = await tx.booth.findMany({
          where: { id: { in: uniqueBoothIds } },
          select: { id: true, price: true }
        });
        // 3. Create Booking
        let totalAmount = new Prisma.Decimal(0);
        const bookingItems = booths.map(b => {
          totalAmount = totalAmount.add(b.price);
          return {
            boothId: b.id,
            price: b.price
          };
        });
        const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 mins
        const booking = await tx.booking.create({
          data: {
            vendorId,
            eventId: data.eventId,
            status: "PAYMENT_PENDING",
            totalAmount,
            holdExpiresAt,
            items: {
              create: bookingItems
            }
          },
          include: {
            items: {
              include: { booth: true }
            }
          }
        });
        return booking;
      });
    } catch (err: any) {
      if (err.code === "P2034" && attempt === 0) {
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
export async function releaseExpiredBookings() {
  const expiredBookings = await db.booking.findMany({
    where: {
      status: "PAYMENT_PENDING",
      holdExpiresAt: {
        lt: new Date()
      }
    },
    include: {
      items: true
    }
  });
  let releasedCount = 0;
  for (const booking of expiredBookings) {
    try {
      await db.$transaction(async (tx) => {
        // Double check status inside transaction
        const current = await tx.booking.findUnique({
          where: { id: booking.id }
        });
        
        if (current?.status === "PAYMENT_PENDING" && current.holdExpiresAt && current.holdExpiresAt < new Date()) {
          // 1. Mark booking EXPIRED
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "EXPIRED" }
          });
          
          // 2. Release booths
          const boothIds = booking.items.map(i => i.boothId);
          await tx.booth.updateMany({
            where: { id: { in: boothIds } },
            data: { status: "AVAILABLE" }
          });
          
          releasedCount++;
        }
      });
    } catch (err) {
      console.error(`Failed to release booking ${booking.id}:`, err);
    }
  }
  
  return releasedCount;
}
