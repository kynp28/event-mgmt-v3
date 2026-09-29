import { Request, Response } from "express";
import * as boothService from "../services/booth.service";
import { createBoothSchema, updateBoothSchema } from "@eventcore/shared";

export async function getBooths(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const booths = await boothService.getBoothsByEvent(eventId, userId);
    res.json(booths);
  } catch (err: any) {
    if (err.message.includes("Event not found")) return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function createBooth(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = createBoothSchema.parse(req.body);
    const booth = await boothService.createBooth(eventId, userId, data);
    res.status(201).json(booth);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", issues: err.issues } });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Booth code already exists in this event" } });
    }
    if (err.message.includes("Event not found")) return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function updateBooth(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const boothId = req.params.boothId;
    const userId = req.user!.id;
    const data = updateBoothSchema.parse(req.body);
    const booth = await boothService.updateBooth(eventId, boothId, userId, data);
    res.json(booth);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", issues: err.issues } });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Booth code already exists in this event" } });
    }
    if (err.message.includes("Cannot edit") || err.message.includes("Cannot manually set")) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: err.message } });
    }
    if (err.message.includes("Event not found") || err.message.includes("Booth not found")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}

export async function deleteBooth(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const boothId = req.params.boothId;
    const userId = req.user!.id;
    await boothService.deleteBooth(eventId, boothId, userId);
    res.status(204).send();
  } catch (err: any) {
    if (err.message.includes("Cannot delete")) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: err.message } });
    }
    if (err.message.includes("Event not found") || err.message.includes("Booth not found")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
}
