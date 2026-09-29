import { Request, Response, NextFunction } from "express";
import * as zoneService from "../services/zone.service";
import { createZoneSchema, updateZoneSchema } from "@eventcore/shared";

export async function getZones(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const zones = await zoneService.getZonesByEvent(eventId, userId);
    res.json(zones);
  } catch (err: any) {
    next(err);
  }
}

export async function createZone(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = createZoneSchema.parse(req.body);
    const zone = await zoneService.createZone(eventId, userId, data);
    res.status(201).json(zone);
  } catch (err: any) {
    next(err);
  }
}

export async function updateZone(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const zoneId = req.params.zoneId;
    const userId = req.user!.id;
    const data = updateZoneSchema.parse(req.body);
    const zone = await zoneService.updateZone(eventId, zoneId, userId, data);
    res.json(zone);
  } catch (err: any) {
    next(err);
  }
}

export async function deleteZone(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const zoneId = req.params.zoneId;
    const userId = req.user!.id;
    await zoneService.deleteZone(eventId, zoneId, userId);
    res.status(204).send();
  } catch (err: any) {
    next(err);
  }
}
