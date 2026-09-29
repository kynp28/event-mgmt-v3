import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/admin.service";
import { verifyOrganizerSchema } from "@eventcore/shared";

export async function getPendingOrganizers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getPendingOrganizers();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function verifyOrganizer(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = verifyOrganizerSchema.parse(req.body);
    const adminId = req.user!.id;
    const result = await adminService.verifyOrganizer(req.params.id, parsed, adminId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getAllUsers();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAllEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getAllEvents();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getOverviewStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getOverviewStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
