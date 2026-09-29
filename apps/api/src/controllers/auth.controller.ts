import { Request, Response, NextFunction } from "express";
import { loginSchema } from "@eventcore/shared";
import { AuthService } from "../services/auth.service";

export const login = async (req: Request, res: Response, next: NextFunction) => {
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

    res.json({ message: "Logged in successfully", user });
  } catch (error: any) {
    next(error);
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
};

export const getMe = (req: Request, res: Response) => {
  res.json({ user: req.user });
};
