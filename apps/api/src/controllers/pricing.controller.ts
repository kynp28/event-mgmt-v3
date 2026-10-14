import { Request, Response, NextFunction } from "express";
import * as pricingService from "../services/pricing.service";
import { feeInputSchema, boothTypeInputSchema } from "../schemas/pricing.schema";

export async function getFees(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const fees = await pricingService.getEventFees(eventId, userId);
    res.json(fees);
  } catch (err) {
    next(err);
  }
}

export async function createFee(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = feeInputSchema.parse(req.body);
    const fee = await pricingService.createEventFee(eventId, userId, data);
    res.status(201).json(fee);
  } catch (err) {
    next(err);
  }
}

export async function updateFee(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const feeId = req.params.feeId;
    const userId = req.user!.id;
    const data = feeInputSchema.parse(req.body);
    const fee = await pricingService.updateEventFee(eventId, feeId, userId, data);
    res.json(fee);
  } catch (err) {
    next(err);
  }
}

export async function deleteFee(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const feeId = req.params.feeId;
    const userId = req.user!.id;
    await pricingService.deleteEventFee(eventId, feeId, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getPublicFees(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.id;
    const fees = await pricingService.getPublicEventFees(eventId);
    res.json(fees);
  } catch (err) {
    next(err);
  }
}

export async function getBoothTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const boothTypes = await pricingService.getBoothTypes(eventId, userId);
    res.json(boothTypes);
  } catch (err) {
    next(err);
  }
}

export async function createBoothType(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.id;
    const data = boothTypeInputSchema.parse(req.body);
    const boothType = await pricingService.createBoothType(eventId, userId, data);
    res.status(201).json(boothType);
  } catch (err) {
    next(err);
  }
}

export async function updateBoothType(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const typeId = req.params.typeId;
    const userId = req.user!.id;
    const data = boothTypeInputSchema.parse(req.body);
    const boothType = await pricingService.updateBoothType(eventId, typeId, userId, data);
    res.json(boothType);
  } catch (err) {
    next(err);
  }
}

export async function deleteBoothType(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const typeId = req.params.typeId;
    const userId = req.user!.id;
    await pricingService.deleteBoothType(eventId, typeId, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
