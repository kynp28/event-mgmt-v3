import { Request, Response } from "express";
import * as zoneService from "../services/zone.service";
import { createZoneSchema, updateZoneSchema } from "@eventcore/shared";

export async function getZones(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const zones = await zoneService.getZonesByEvent(eventId, userId);
    res.json(zones);
  } catch (err: any) {
    if (err.message.includes("Event not found")) return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function createZone(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = createZoneSchema.parse(req.body);
    const zone = await zoneService.createZone(eventId, userId, data);
    res.status(201).json(zone);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", issues: err.issues } });
    }
    if (err.message.includes("Event not found")) return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function updateZone(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const zoneId = req.params.zoneId;
    const userId = req.user!.id;
    const data = updateZoneSchema.parse(req.body);
    const zone = await zoneService.updateZone(eventId, zoneId, userId, data);
    res.json(zone);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", issues: err.issues } });
    }
    if (err.message.includes("Event not found") || err.message.includes("Zone not found")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function deleteZone(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const zoneId = req.params.zoneId;
    const userId = req.user!.id;
    await zoneService.deleteZone(eventId, zoneId, userId);
    res.status(204).send();
  } catch (err: any) {
    if (err.message.includes("Event not found") || err.message.includes("Zone not found")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}
