import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";
import { Role } from "@eventcore/shared";

interface JwtPayload {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No token provided" } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: { organizerProfile: true }
    });

    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not found" } });
    }

    if (user.role === "ORGANIZER") {
      if (!user.organizerProfile || user.organizerProfile.status !== "APPROVED") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Organizer account is not approved" } });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
    }
    next();
  };
};

// We will export a helper function to verify ownership (not as a middleware because it might need async params)
export const verifyOrganizerEventOwnership = async (userId: string, eventId: string) => {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true }
  });
  if (!event || event.organizerId !== userId) {
    throw new Error("FORBIDDEN");
  }
};
