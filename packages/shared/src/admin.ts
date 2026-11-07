import { z } from "zod";
import type { BusinessStatus, BusinessType } from "./constants";
import type { VerificationStatus } from "./api-types";

// Types and schemas for the admin API (/api/v1/admin/*). Owner: Kalindu.

export const BUSINESS_STATUS_FILTERS = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED", "ALL"] as const;
export type BusinessStatusFilter = (typeof BUSINESS_STATUS_FILTERS)[number];

// POST /admin/businesses/:id/reject  (a reason is required so the business knows why)
export const rejectBusinessSchema = z.object({
  remarks: z.string().trim().min(3, "Write a reason for the business").max(500),
});
export type RejectBusinessInput = z.infer<typeof rejectBusinessSchema>;

// GET /admin/businesses
export type AdminBusinessDto = {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  registrationNo: string | null;
  description: string | null;
  contactNo: string;
  addressLine: string;
  city: string;
  district: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  owner: { id: string; fullName: string; email: string; phone: string | null };
  verification: {
    status: VerificationStatus;
    documentUrl: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    remarks: string | null;
  } | null;
};
