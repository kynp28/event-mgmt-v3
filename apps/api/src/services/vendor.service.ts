import { db } from "../lib/db";
import { UpdateVendorProfilePayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";

export class VendorService {
  static async getProfile(userId: string) {
    const profile = await db.vendorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new AppError(404, "VENDOR_PROFILE_NOT_FOUND", "Vendor profile not found");
    }
    return profile;
  }

  static async upsertProfile(userId: string, data: UpdateVendorProfilePayload): Promise<{ profile: any; isNew: boolean }> {
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        const profile = await db.vendorProfile.create({
          data: {
            userId,
            storeName: data.storeName,
            productType: data.productType,
          },
        });
        return { profile, isNew: true };
      } catch (err: any) {
        if (err.code === "P2002" || err.code === "P2034") {
          try {
            const profile = await db.vendorProfile.update({
              where: { userId },
              data: {
                storeName: data.storeName,
                productType: data.productType,
              },
            });
            return { profile, isNew: false };
          } catch (updateErr: any) {
            if ((updateErr.code === "P2025" || updateErr.code === "P2034") && attempts < 3) {
              continue;
            }
            throw new AppError(500, "INTERNAL_ERROR", "Failed to update vendor profile");
          }
        }
        throw new AppError(500, "INTERNAL_ERROR", "Failed to create vendor profile");
      }
    }
    throw new AppError(500, "INTERNAL_ERROR", "Max attempts reached for upserting profile");
  }
}
