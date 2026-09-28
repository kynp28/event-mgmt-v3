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

export const EventStatusEnum = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);
export type EventStatus = z.infer<typeof EventStatusEnum>;

export const rawEventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  startDate: utcDateSchema,
  endDate: utcDateSchema,
  location: z.string().min(1, "Location is required"),
  coverImage: z.string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "Must be a base64 encoded jpeg/png/webp image")
    .refine((val) => val.length <= 2.8 * 1024 * 1024, "Image must be less than 2MB")
    .optional().nullable(),
  maxBoothsPerVendor: z.coerce.number().int().min(1).default(3),
});

export const baseEventSchema = rawEventSchema.refine(data => data.endDate >= data.startDate, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

export const createEventSchema = baseEventSchema;
export type CreateEventPayload = z.infer<typeof createEventSchema>;

export const updateEventSchema = rawEventSchema.partial().refine(data => {
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});
export type UpdateEventPayload = z.infer<typeof updateEventSchema>;

export const changeEventStatusSchema = z.object({
  status: EventStatusEnum,
});
export type ChangeEventStatusPayload = z.infer<typeof changeEventStatusSchema>;
