import { Request, Response } from "express";
import { z } from "zod";
import * as eventService from "../services/event.service";
import { createEventSchema, updateEventSchema, changeEventStatusSchema } from "@eventcore/shared";

// List public events (PUBLISHED only)
export async function getPublicEvents(req: Request, res: Response) {
  const events = await eventService.getPublicEvents();
  res.json(events);
}

// Get public event details (PUBLISHED only)
export async function getPublicEventById(req: Request, res: Response) {
  const event = await eventService.getPublicEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
  }
  res.json(event);
}

// Organizer: List my events
export async function getMyEvents(req: Request, res: Response) {
  const events = await eventService.getEventsByOrganizer(req.user!.id);
  res.json(events);
}

// Organizer: Get my event details
export async function getMyEventById(req: Request, res: Response) {
  const event = await eventService.getEventById(req.params.id, req.user!.id);
  if (!event) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
  }
  res.json(event);
}

// Organizer: Create event
export async function createEvent(req: Request, res: Response) {
  try {
    const data = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(req.user!.id, data);
    res.status(201).json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
    } else {
      throw err;
    }
  }
}

// Organizer: Update event
export async function updateEvent(req: Request, res: Response) {
  try {
    const data = updateEventSchema.parse(req.body);
    const event = await eventService.updateEvent(req.params.id, req.user!.id, data);
    if (!event) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found or not owned by you" } });
    }
    res.json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
    } else {
      throw err;
    }
  }
}

// Organizer: Change status
export async function changeEventStatus(req: Request, res: Response) {
  try {
    const data = changeEventStatusSchema.parse(req.body);
    const event = await eventService.changeEventStatus(req.params.id, req.user!.id, data.status);
    if (!event) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found or not owned by you" } });
    }
    res.json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", details: err.errors } });
    } else if (err instanceof Error) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: err.message } });
    } else {
      throw err;
    }
  }
}

import * as boothService from '../services/booth.service';

export async function getEventBooths(req: Request, res: Response) {
  try {
    const booths = await boothService.getVisibleEventBooths(req.params.id, req.user!.id, req.user!.role);
    res.json(booths);
  } catch (err: any) {
    if (err.code === "NOT_FOUND" || (err.error && err.error.code === "NOT_FOUND")) {
      return res.status(404).json(err.error || { error: { code: "NOT_FOUND", message: err.message } });
    }
    throw err;
  }
}
