
import { z } from "zod";

// Create a reservation.
// The backend determines buyerId, price, status and pickupCode.
export const createReservationSchema = z.object({
  listingId: z.uuid(),
  quantity: z.number().int().positive(),
});

// Cancel an existing reservation.
export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(250).optional(),
});

// Seller uses the pickup code to confirm collection.
export const verifyPickupSchema = z.object({
  pickupCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .regex(/^[A-Za-z0-9]+$/, "Pickup code must contain only letters and numbers"),
});

// TypeScript types inferred from the validation schemas.
export type CreateReservationInput = z.infer<
  typeof createReservationSchema
>;

export type CancelReservationInput = z.infer<
  typeof cancelReservationSchema
>;

export type VerifyPickupInput = z.infer<
  typeof verifyPickupSchema
>;
