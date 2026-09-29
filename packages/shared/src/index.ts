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

// Zone Schemas
export const createZoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional().nullable(),
});
export type CreateZonePayload = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = createZoneSchema.partial();
export type UpdateZonePayload = z.infer<typeof updateZoneSchema>;

// Booth Schemas
export const BoothStatusEnum = z.enum(["AVAILABLE", "PAYMENT_PENDING", "BOOKED", "DISABLED"]);
export type BoothStatus = z.infer<typeof BoothStatusEnum>;

// We allow inputting numbers or strings for money/dimensions, but transform them to strings to avoid JS float issues,
// and let the server handle them via Prisma Decimal.
const decimalSchema = z.union([z.string(), z.number()]).transform((val) => String(val))
  .refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid positive number");

export const createBoothSchema = z.object({
  code: z.string().min(1, "Code is required"),
  zoneId: z.string().optional().nullable(),
  price: decimalSchema,
  physicalLength: decimalSchema.optional().nullable(),
  physicalWidth: decimalSchema.optional().nullable(),
  status: z.enum(["AVAILABLE", "DISABLED"]).default("AVAILABLE"),
});
export type CreateBoothPayload = z.infer<typeof createBoothSchema>;

export const updateBoothSchema = createBoothSchema.partial();
export type UpdateBoothPayload = z.infer<typeof updateBoothSchema>;

// Booking Schemas
export const BookingStatusEnum = z.enum(["PAYMENT_PENDING", "PENDING_VERIFICATION", "CONFIRMED", "CANCELLED", "EXPIRED"]);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const createBookingSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  boothIds: z.array(z.string()).min(1, "Must select at least one booth"),
});
export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

// Payment Schemas
export const PaymentStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const uploadSlipSchema = z.object({
  slipImage: z.string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "Must be a base64 encoded jpeg/png/webp image")
    .refine((val) => val.length <= 2.8 * 1024 * 1024, "Image must be less than 2MB"),
});
export type UploadSlipPayload = z.infer<typeof uploadSlipSchema>;

export const verifyPaymentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional().nullable(),
}).refine(data => {
  if (data.status === "REJECTED" && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Rejection reason is required when rejecting",
  path: ["rejectionReason"],
});
export type VerifyPaymentPayload = z.infer<typeof verifyPaymentSchema>;

export const checkInSchema = z.object({ token: z.string().min(1, 'Token is required') });
export type CheckInPayload = z.infer<typeof checkInSchema>;
