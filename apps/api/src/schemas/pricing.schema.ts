import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createBoothSchema, updateBoothSchema } from "@eventcore/shared";

const decimal12_2Schema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val).trim())
  .refine((val) => {
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    try {
      const d = new Prisma.Decimal(val);
      return d.gte(0) && d.lte(new Prisma.Decimal("9999999999.99"));
    } catch {
      return false;
    }
  }, "Must be a valid non-negative decimal up to 9999999999.99");

const decimal8_2Schema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val).trim())
  .refine((val) => {
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    try {
      const d = new Prisma.Decimal(val);
      return d.gte(0) && d.lte(new Prisma.Decimal("999999.99"));
    } catch {
      return false;
    }
  }, "Must be a valid non-negative decimal up to 999999.99");

export const feeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name cannot exceed 100 characters"),
    amount: decimal12_2Schema,
    type: z.enum(["PER_BOOKING", "PER_BOOTH"]),
  })
  .strict();

export type FeeInputPayload = z.infer<typeof feeInputSchema>;

export const boothTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name cannot exceed 100 characters"),
    price: decimal12_2Schema,
    physicalWidth: decimal8_2Schema.optional().nullable(),
    physicalLength: decimal8_2Schema.optional().nullable(),
  })
  .strict();

export type BoothTypeInputPayload = z.infer<typeof boothTypeInputSchema>;

export const createBoothWithTypeSchema = createBoothSchema.extend({
  boothTypeId: z.string().min(1).optional().nullable(),
});

export type CreateBoothWithTypePayload = z.infer<typeof createBoothWithTypeSchema>;

export const updateBoothWithTypeSchema = updateBoothSchema.extend({
  boothTypeId: z.string().min(1).optional().nullable(),
});

export type UpdateBoothWithTypePayload = z.infer<typeof updateBoothWithTypeSchema>;
