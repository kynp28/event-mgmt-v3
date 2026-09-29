import { Request, Response, NextFunction } from "express";
import * as boothService from "../services/booth.service";
import { createBoothSchema, updateBoothSchema } from "@eventcore/shared";

export async function getBooths(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const booths = await boothService.getBoothsByEvent(eventId, userId);
    res.json(booths);
  } catch (err: any) {
    next(err);
  }
}

export async function createBooth(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = createBoothSchema.parse(req.body);
    const booth = await boothService.createBooth(eventId, userId, data);
    res.status(201).json(booth);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Booth code already exists in this event" } });
    }
    next(err);
  }
}

export async function updateBooth(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const boothId = req.params.boothId;
    const userId = req.user!.id;
    const data = updateBoothSchema.parse(req.body);
    const booth = await boothService.updateBooth(eventId, boothId, userId, data);
    res.json(booth);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Booth code already exists in this event" } });
    }
    next(err);
  }
}

export async function deleteBooth(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const boothId = req.params.boothId;
    const userId = req.user!.id;
    await boothService.deleteBooth(eventId, boothId, userId);
    res.status(204).send();
  } catch (err: any) {
    next(err);
  }
}
import { updateBoothPositionsSchema } from '@eventcore/shared';

export async function updatePositions(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = updateBoothPositionsSchema.parse(req.body);
    const result = await boothService.updateBoothPositions(eventId, userId, data);
    res.json(result);
  } catch (err: any) {
    next(err);
  }
}
