import { db } from "../lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { LoginPayload } from "@eventcore/shared";
import { AppError } from "../utils/AppError";

export class AuthService {
  static async login(data: LoginPayload) {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { organizerProfile: true }
    });

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    if (user.role === "ORGANIZER") {
      if (!user.organizerProfile || user.organizerProfile.status === "PENDING") {
        throw new AppError(403, "ORGANIZER_NOT_APPROVED", "Organizer account is pending approval");
      }
      if (user.organizerProfile.status === "REJECTED") {
        const log = await db.auditLog.findFirst({
          where: { entityType: "OrganizerProfile", entityId: user.organizerProfile.id, action: "REJECTED" },
          orderBy: { createdAt: "desc" }
        });
        const reason = log?.metadata && typeof log.metadata === "object" && "reason" in log.metadata 
          ? (log.metadata as any).reason 
          : "No reason provided";
        throw new AppError(403, "ORGANIZER_REJECTED", `Organizer account was rejected. Reason: ${reason}`);
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

    return { token, user };
  }
}
