import type { BusinessStatus, BusinessType, Role } from "./constants";

// Shapes of API responses, shared so the mobile app and the API agree.
// Dates arrive as ISO strings because they travel as JSON.

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

// GET /api/v1/auth/me
export type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  profilePictureUrl: string | null;
  business: {
    id: string;
    name: string;
    type: BusinessType;
    status: BusinessStatus;
    verification: { status: VerificationStatus; remarks: string | null; reviewedAt: string | null } | null;
  } | null;
};

// POST /api/v1/auth/register
export type RegisterResponse = {
  user: { id: string; email: string; fullName: string; role: Role; status: string };
  business: { id: string; name: string; status: BusinessStatus } | null;
};

// Every API error has this shape.
export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
