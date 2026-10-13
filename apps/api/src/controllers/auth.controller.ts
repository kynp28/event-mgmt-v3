import { Request, Response, NextFunction } from "express";
import { loginSchema, registerVendorSchema } from "@eventcore/shared";
import { AuthService } from "../services/auth.service";
import { setAuthCookie } from "../utils/cookie";

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid input", details: parsed.error.format() } });
    }

    const { token, user } = await AuthService.login(parsed.data);

    setAuthCookie(res, token);
    res.json({ message: "Logged in successfully", user });
  } catch (error: any) {
    next(error);
  }
};

export const registerVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerVendorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid input", details: parsed.error.format() } });
    }

    const { token, user } = await AuthService.registerVendor(parsed.data);

    setAuthCookie(res, token);
    res.status(201).json({ message: "Vendor registered successfully", user });
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
