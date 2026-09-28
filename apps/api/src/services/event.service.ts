import { db } from "../lib/db";
import { CreateEventPayload, UpdateEventPayload, EventStatus } from "@eventcore/shared";

const listSelect = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  location: true,
  maxBoothsPerVendor: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organizerId: true,
};

export async function getPublicEvents() {
  return db.event.findMany({
    where: { status: "PUBLISHED" },
    select: listSelect,
    orderBy: { startDate: "asc" },
  });
}

export async function getPublicEventById(id: string) {
  return db.event.findFirst({
    where: { id, status: "PUBLISHED" },
    // we omit the select here to get all fields, including coverImage
  });
}

export async function getEventsByOrganizer(organizerId: string) {
  return db.event.findMany({
    where: { organizerId },
    select: listSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getEventById(id: string, organizerId: string) {
  return db.event.findFirst({
    where: { id, organizerId },
  });
}

export async function createEvent(organizerId: string, data: CreateEventPayload) {
  return db.event.create({
    data: {
      ...data,
      organizerId,
      status: "DRAFT", // always start as draft
    },
  });
}

export async function updateEvent(id: string, organizerId: string, data: UpdateEventPayload) {
  // Verify ownership
  const event = await db.event.findFirst({
    where: { id, organizerId },
  });
  if (!event) return null;

  return db.event.update({
    where: { id },
    data,
  });
}

export async function changeEventStatus(id: string, organizerId: string, status: EventStatus) {
  const event = await db.event.findFirst({
    where: { id, organizerId },
  });
  if (!event) return null;

  // Additional rules could be checked here (e.g., cannot publish without zones/booths)
  return db.event.update({
    where: { id },
    data: { status },
  });
}
