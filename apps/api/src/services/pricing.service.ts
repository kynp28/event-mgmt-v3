import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { AppError } from "../utils/AppError";
import { FeeInputPayload, BoothTypeInputPayload } from "../schemas/pricing.schema";

export const MAX_FEES_PER_EVENT = 20;

async function verifyEventOwnership(eventId: string, organizerId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, organizerId }
  });
  if (!event) {
    throw new AppError(404, "NOT_FOUND", "Event not found or not owned by you");
  }
}

export async function getEventFees(eventId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  return db.eventFee.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
}

export async function createEventFee(eventId: string, organizerId: string, data: FeeInputPayload) {
  await verifyEventOwnership(eventId, organizerId);

  const feeCount = await db.eventFee.count({ where: { eventId } });
  if (feeCount >= MAX_FEES_PER_EVENT) {
    throw new AppError(400, "LIMIT_EXCEEDED", `Maximum ${MAX_FEES_PER_EVENT} fees allowed per event`);
  }

  try {
    return await db.eventFee.create({
      data: {
        eventId,
        name: data.name,
        amount: new Prisma.Decimal(data.amount),
        type: data.type
      }
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Fee name already exists in this event");
    }
    throw err;
  }
}

export async function updateEventFee(eventId: string, feeId: string, organizerId: string, data: FeeInputPayload) {
  await verifyEventOwnership(eventId, organizerId);

  const fee = await db.eventFee.findFirst({
    where: { id: feeId, eventId }
  });
  if (!fee) {
    throw new AppError(404, "NOT_FOUND", "Fee not found");
  }

  try {
    return await db.eventFee.update({
      where: { id: feeId },
      data: {
        name: data.name,
        amount: new Prisma.Decimal(data.amount),
        type: data.type
      }
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Fee name already exists in this event");
    }
    throw err;
  }
}

export async function deleteEventFee(eventId: string, feeId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);

  const fee = await db.eventFee.findFirst({
    where: { id: feeId, eventId }
  });
  if (!fee) {
    throw new AppError(404, "NOT_FOUND", "Fee not found");
  }

  return db.eventFee.delete({
    where: { id: feeId }
  });
}

export async function getPublicEventFees(eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === "DRAFT") {
    throw new AppError(404, "NOT_FOUND", "Event not found");
  }

  return db.eventFee.findMany({
    where: { eventId },
    select: {
      name: true,
      type: true,
      amount: true
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
}

export async function getBoothTypes(eventId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);
  return db.boothType.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
}

export async function createBoothType(eventId: string, organizerId: string, data: BoothTypeInputPayload) {
  await verifyEventOwnership(eventId, organizerId);

  try {
    return await db.boothType.create({
      data: {
        eventId,
        name: data.name,
        price: new Prisma.Decimal(data.price),
        physicalWidth: data.physicalWidth != null ? new Prisma.Decimal(data.physicalWidth) : null,
        physicalLength: data.physicalLength != null ? new Prisma.Decimal(data.physicalLength) : null
      }
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Booth type name already exists in this event");
    }
    throw err;
  }
}

export async function updateBoothType(eventId: string, typeId: string, organizerId: string, data: BoothTypeInputPayload) {
  await verifyEventOwnership(eventId, organizerId);

  const boothType = await db.boothType.findFirst({
    where: { id: typeId, eventId }
  });
  if (!boothType) {
    throw new AppError(404, "NOT_FOUND", "Booth type not found");
  }

  try {
    return await db.boothType.update({
      where: { id: typeId },
      data: {
        name: data.name,
        price: new Prisma.Decimal(data.price),
        physicalWidth: data.physicalWidth != null ? new Prisma.Decimal(data.physicalWidth) : null,
        physicalLength: data.physicalLength != null ? new Prisma.Decimal(data.physicalLength) : null
      }
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Booth type name already exists in this event");
    }
    throw err;
  }
}

export async function deleteBoothType(eventId: string, typeId: string, organizerId: string) {
  await verifyEventOwnership(eventId, organizerId);

  const boothType = await db.boothType.findFirst({
    where: { id: typeId, eventId }
  });
  if (!boothType) {
    throw new AppError(404, "NOT_FOUND", "Booth type not found");
  }

  return db.boothType.delete({
    where: { id: typeId }
  });
}
