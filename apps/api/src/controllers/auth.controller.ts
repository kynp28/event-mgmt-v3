import { Request, Response } from "express";
import { loginSchema } from "@eventcore/shared";
import { AuthService } from "../services/auth.service";

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid input", details: parsed.error.format() } });
    }

    const { token, user } = await AuthService.login(parsed.data);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ message: "Logged in successfully" });
  } catch (error: any) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } });
    }
    if (error.message === "ORGANIZER_NOT_APPROVED") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Organizer account is not approved yet" } });
    }
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
};

export const getMe = (req: Request, res: Response) => {
  res.json({ user: req.user });
};
