# Auth API

Base path: `/api/v1`. Every response has one of two shapes:

```json
{ "data": { } }
{ "error": { "code": "SOME_CODE", "message": "Readable text", "details": [] } }
```

Login (email and password) is done by the mobile app directly with Supabase. The app then sends
the access token on every protected request: `Authorization: Bearer <token>`.

## GET /health  (public)

`200` `{ "data": { "status": "ok", "database": "up", "time": "..." } }`
`503 DATABASE_UNAVAILABLE` if the database cannot be reached.

## POST /auth/register  (public)

Creates the login account and the BiteGo profile. `role` is `CUSTOMER` or `BUSINESS` (never `ADMIN`).
A business starts as `PENDING` and cannot sell or buy until an admin approves it.

Customer:

```json
{ "role": "CUSTOMER", "email": "nimal@example.com", "password": "secret123", "fullName": "Nimal Perera", "phone": "0771234567" }
```

Business (`phone`, `registrationNo`, `description`, `email`, `district`, `documentUrl` are optional):

```json
{
  "role": "BUSINESS", "email": "bakery@example.com", "password": "secret123", "fullName": "Kamala Silva",
  "business": {
    "name": "Sun Bakery", "type": "BAKERY", "contactNo": "0712345678",
    "addressLine": "12 Main St", "city": "Balangoda", "latitude": 6.65, "longitude": 80.69
  }
}
```

`201` `{ "data": { "user": { "id", "email", "fullName", "role", "status" }, "business": { "id", "name", "status" } | null } }`

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `details` lists each invalid field |
| 400 | `INVALID_JSON` | body is not JSON |
| 409 | `ACCOUNT_EXISTS` | email or phone already used |
| 409 | `REGISTRATION_NO_EXISTS` | business registration number already used |

After registering, the app signs in with Supabase to get a token.

## GET /auth/me  (any signed-in user)

`200` the profile: `id, email, fullName, phone, role, status, profilePictureUrl` and
`business: { id, name, type, status, verification: { status, remarks, reviewedAt } } | null`.

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | missing, invalid or expired token |
| 403 | `PROFILE_NOT_FOUND` | signed in but no BiteGo profile |
| 403 | `ACCOUNT_DISABLED` | user is not `ACTIVE` |

## For module developers: protecting a route

```ts
import { requireUser, requireRole, requireApprovedBusiness } from "@/server/middleware/auth";

const { user } = await requireUser(req);                        // any signed-in user
const { user } = await requireRole(req, "ADMIN");               // 403 FORBIDDEN otherwise
const { user, business } = await requireApprovedBusiness(req);  // 403 BUSINESS_NOT_APPROVED otherwise
```

Wrap handlers with `route(...)` and `throw new ApiError(status, "CODE", "message")` for errors.
Validate bodies with `parseBody(req, schema)`; put schemas shared with the mobile app in `packages/shared/src`.
