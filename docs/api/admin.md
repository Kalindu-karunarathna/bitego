# Admin API

Owner: Kalindu. Every route here needs `Authorization: Bearer <token>` of a user with role `ADMIN`
(`401 UNAUTHENTICATED` without a token, `403 FORBIDDEN` for other roles). Responses use `{data}` / `{error}` as in `auth.md`.

## Business approval

A business registers in the mobile app and stays `PENDING` (cannot sell or buy) until approved here.

### GET /admin/businesses?status=PENDING

`status` is `PENDING` (default), `ACTIVE`, `REJECTED`, `SUSPENDED` or `ALL`. Oldest first for `PENDING`, newest first otherwise (max 200).
`200` `{ "data": [ AdminBusinessDto ] }` (owner details, address, coordinates, latest verification). Type in `@bitego/shared`.

### POST /admin/businesses/:id/approve

No body. `PENDING` or `REJECTED` becomes `ACTIVE`. The latest verification becomes `APPROVED`, an audit log row is written,
and the owner gets a `BUSINESS_APPROVED` notification. `200` returns the updated business.
`404 BUSINESS_NOT_FOUND`, `409 INVALID_STATE` (already approved or suspended).

### POST /admin/businesses/:id/reject

Body `{ "remarks": "reason" }` (3 to 500 characters, required). Only `PENDING` becomes `REJECTED`. The mobile app shows the remarks.
`400 VALIDATION_ERROR`, `404 BUSINESS_NOT_FOUND`, `409 INVALID_STATE`.

## Admin web dashboard

`/admin/login`, then `/admin/businesses`. It needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(the publishable key) in `apps/web/.env`. Restart `npm run dev:web` after adding them.
