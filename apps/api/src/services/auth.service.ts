import { db } from "../lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { LoginPayload } from "@eventcore/shared";

export class AuthService {
  static async login(data: LoginPayload) {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { organizerProfile: true }
    });

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (user.role === "ORGANIZER") {
      if (!user.organizerProfile || user.organizerProfile.status !== "APPROVED") {
        throw new Error("ORGANIZER_NOT_APPROVED");
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

    return { token, user };
  }
}
