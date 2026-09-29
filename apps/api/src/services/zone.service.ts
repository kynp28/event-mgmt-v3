import { db } from "../lib/db";
import { CreateZonePayload, UpdateZonePayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";

async function verifyEventOwnership(eventId: string, organizerId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, organizerId }
  });
  if (!event) {
    throw new AppError(404, "NOT_FOUND", "Event not found or not owned by you");
  }
}

export async function getZonesByEvent(eventId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  return db.zone.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" }
  });
}

export async function createZone(eventId: string, organizerId: string, data: CreateZonePayload) {
  await verifyEventOwnership(eventId, organizerId);
  return db.zone.create({
    data: {
      eventId,
      name: data.name,
      color: data.color
    }
  });
}

export async function updateZone(eventId: string, zoneId: string, organizerId: string, data: UpdateZonePayload) {
  await verifyEventOwnership(eventId, organizerId);
  
  const zone = await db.zone.findFirst({
    where: { id: zoneId, eventId }
  });
  if (!zone) throw new AppError(404, "NOT_FOUND", "Zone not found");

  return db.zone.update({
    where: { id: zoneId },
    data
  });
}

export async function deleteZone(eventId: string, zoneId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  
  const zone = await db.zone.findFirst({
    where: { id: zoneId, eventId }
  });
  if (!zone) throw new AppError(404, "NOT_FOUND", "Zone not found");

  return db.zone.delete({
    where: { id: zoneId }
  });
}
