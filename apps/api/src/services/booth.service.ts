import { db } from "../lib/db";
import { CreateBoothPayload, UpdateBoothPayload } from "@eventcore/shared";

async function verifyEventOwnership(eventId: string, organizerId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, organizerId }
  });
  if (!event) {
    throw new Error("Event not found or not owned by you");
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
  if (!booth) throw new Error("Booth not found");
  
  if (booth.status === "BOOKED" || booth.status === "PAYMENT_PENDING") {
    throw new Error(`Cannot edit a booth in ${booth.status} status`);
  }

  // Double check that we are not trying to update it to an illegal status manually
  if (data.status && data.status !== "AVAILABLE" && data.status !== "DISABLED") {
    throw new Error(`Cannot manually set booth status to ${data.status}`);
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
  if (!booth) throw new Error("Booth not found");

  if (booth.status === "BOOKED" || booth.status === "PAYMENT_PENDING") {
    throw new Error(`Cannot delete a booth in ${booth.status} status`);
  }

  return db.booth.delete({
    where: { id: boothId }
  });
}
