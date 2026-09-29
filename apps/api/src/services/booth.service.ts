import { db } from "../lib/db";
import { CreateBoothPayload, UpdateBoothPayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";

async function verifyEventOwnership(eventId: string, organizerId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, organizerId }
  });
  if (!event) {
    throw new AppError(404, "NOT_FOUND", "Event not found or not owned by you");
  }
}

export async function getBoothsByEvent(eventId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  return db.booth.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" }
  });
}

export async function createBooth(eventId: string, organizerId: string, data: CreateBoothPayload) {
  await verifyEventOwnership(eventId, organizerId);
  return db.booth.create({
    data: {
      eventId,
      code: data.code,
      zoneId: data.zoneId || null,
      price: data.price,
      physicalLength: data.physicalLength || null,
      physicalWidth: data.physicalWidth || null,
      status: data.status || "AVAILABLE"
    }
  });
}

export async function updateBooth(eventId: string, boothId: string, organizerId: string, data: UpdateBoothPayload) {
  await verifyEventOwnership(eventId, organizerId);
  
  const booth = await db.booth.findFirst({
    where: { id: boothId, eventId }
  });
  if (!booth) throw new AppError(404, "NOT_FOUND", "Booth not found");
  
  if (booth.status === "BOOKED" || booth.status === "PAYMENT_PENDING") {
    throw new AppError(400, "BAD_REQUEST", `Cannot edit a booth in ${booth.status} status`);
  }

  // Double check that we are not trying to update it to an illegal status manually
  if (data.status && data.status !== "AVAILABLE" && data.status !== "DISABLED") {
    throw new AppError(400, "BAD_REQUEST", `Cannot manually set booth status to ${data.status}`);
  }

  return db.booth.update({
    where: { id: boothId },
    data: {
      code: data.code,
      zoneId: data.zoneId !== undefined ? data.zoneId : undefined,
      price: data.price,
      physicalLength: data.physicalLength !== undefined ? data.physicalLength : undefined,
      physicalWidth: data.physicalWidth !== undefined ? data.physicalWidth : undefined,
      status: data.status,
    }
  });
}

export async function deleteBooth(eventId: string, boothId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  
  const booth = await db.booth.findFirst({
    where: { id: boothId, eventId }
  });
  if (!booth) throw new AppError(404, "NOT_FOUND", "Booth not found");

  if (booth.status === "BOOKED" || booth.status === "PAYMENT_PENDING") {
    throw new AppError(400, "BAD_REQUEST", `Cannot delete a booth in ${booth.status} status`);
  }

  return db.booth.delete({
    where: { id: boothId }
  });
}
import { UpdateBoothPositionsPayload } from '@eventcore/shared';

export async function updateBoothPositions(eventId: string, organizerId: string, data: UpdateBoothPositionsPayload) {
  await verifyEventOwnership(eventId, organizerId);
  
  // Update sequentially for simplicity (or use transaction)
  await db.$transaction(
    data.positions.map(p => 
      db.booth.update({
        where: { id: p.boothId, eventId }, // Also guards against cross-event injection
        data: {
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          rotation: p.rotation
        }
      })
    )
  );
  return { success: true };
}

export async function getVisibleEventBooths(eventId: string, userId: string, userRole: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found");
  
  if (event.status === "DRAFT" || event.status === "CLOSED") { // Actually the user said if DRAFT, return 404 unless organizer/admin.
    if (userRole !== "ADMIN" && event.organizerId !== userId) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }
  }

  return db.booth.findMany({
    where: { eventId },
    select: {
      id: true,
      code: true,
      price: true,
      physicalLength: true,
      physicalWidth: true,
      x: true,
      y: true,
      width: true,
      height: true,
      rotation: true,
      zoneId: true,
      status: true
    },
    orderBy: { createdAt: "asc" }
  });
}
