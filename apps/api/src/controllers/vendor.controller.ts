import { Request, Response, NextFunction } from "express";
import { updateVendorProfileSchema } from "@eventcore/shared";
import { VendorService } from "../services/vendor.service";

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await VendorService.getProfile(req.user!.id);
    res.json({ profile });
  } catch (error: any) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateVendorProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid input", details: parsed.error.format() } });
    }

    const { profile, isNew } = await VendorService.upsertProfile(req.user!.id, parsed.data);
    const status = isNew ? 201 : 200;
    res.status(status).json({ message: "Profile updated successfully", profile });
  } catch (error: any) {
    next(error);
  }
};
