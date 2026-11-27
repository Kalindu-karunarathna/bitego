import { z } from "zod";
import { BUSINESS_TYPES } from "./constants";

// Validation for POST /api/v1/auth/register.
// The mobile registration forms and the API use the same schema.
// "role" can only be CUSTOMER or BUSINESS. ADMIN accounts are never self-registered.

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const phone = z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");
const fullName = z.string().trim().min(2, "Enter your full name").max(100);

const businessDetails = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  type: z.enum(BUSINESS_TYPES, { error: "Choose a business type" }),
  registrationNo: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(500).optional(),
  contactNo: phone,
  email: email.optional(),
  addressLine: z.string().trim().min(3, "Enter the shop address").max(200),
  city: z.string().trim().min(2, "Enter the city").max(80),
  district: z.string().trim().min(2).max(80).optional(),
  // Shop location: from the phone's GPS button and the map pin.
  latitude: z.number({ error: "Set your shop location" }).min(-90).max(90),
  longitude: z.number({ error: "Set your shop location" }).min(-180).max(180),
  // Business registration document (uploaded first, then its URL is sent here).
  documentUrl: z.url().optional(),
});

export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("CUSTOMER"),
    email,
    password,
    fullName,
    phone: phone.optional(),
  }),
  z.object({
    role: z.literal("BUSINESS"),
    email,
    password,
    fullName,
    phone: phone.optional(),
    business: businessDetails,
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;
