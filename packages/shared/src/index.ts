import { z } from "zod";

// Role Enum
export const RoleEnum = z.enum(["ADMIN", "ORGANIZER", "VENDOR"]);
export type Role = z.infer<typeof RoleEnum>;

// Login Payload Schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginPayload = z.infer<typeof loginSchema>;

// User/Session DTO
export const userSessionSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: RoleEnum,
});
export type UserSession = z.infer<typeof userSessionSchema>;

// Dates helper: accepts YYYY-MM-DD or full ISO 8601, outputs a UTC Date
export const utcDateSchema = z.string().transform((val, ctx) => {
  const date = new Date(val.includes("T") ? val : `${val}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date format",
    });
    return z.NEVER;
  }
  return date;
});
