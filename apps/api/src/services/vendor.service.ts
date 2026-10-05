import { db } from "../lib/db";
import { UpdateVendorProfilePayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";

export class VendorService {
  static async getProfile(userId: string) {
    const profile = await db.vendorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Vendor profile not found");
    }
    return profile;
  }

  static async updateProfile(userId: string, data: UpdateVendorProfilePayload) {
    const profile = await db.vendorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Vendor profile not found");
    }

    return db.vendorProfile.update({
      where: { userId },
      data: {
        ...(data.storeName && { storeName: data.storeName }),
        ...(data.productType && { productType: data.productType }),
      },
    });
  }
}
