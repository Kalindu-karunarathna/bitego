# Admin API

Owner: Kalindu. Every route here needs `Authorization: Bearer <token>` of a user with role `ADMIN`
(`401 UNAUTHENTICATED` without a token, `403 FORBIDDEN` for other roles). Responses use `{data}` / `{error}` as in `auth.md`.
Types and schemas are in `@bitego/shared` (`admin.ts`). Every change below writes a row to `audit_logs`.

## Business approval

A business registers in the mobile app and stays `PENDING` (cannot sell or buy) until approved here.

### GET /admin/businesses?status=PENDING
`status` is `PENDING` (default), `ACTIVE`, `REJECTED`, `SUSPENDED` or `ALL`. Oldest first for `PENDING`, newest first otherwise (max 200).
`200` `{ "data": [ AdminBusinessDto ] }` (owner details, address, coordinates, latest verification).

### POST /admin/businesses/:id/approve
No body. `PENDING` or `REJECTED` becomes `ACTIVE`. The latest verification becomes `APPROVED`, and the owner gets a
`BUSINESS_APPROVED` notification. `404 BUSINESS_NOT_FOUND`, `409 INVALID_STATE`.

### POST /admin/businesses/:id/reject
Body `{ "remarks": "reason" }` (3 to 500 characters, required). Only `PENDING` becomes `REJECTED`. The mobile app shows the remarks.
`400 VALIDATION_ERROR`, `404 BUSINESS_NOT_FOUND`, `409 INVALID_STATE`.

## Users

### GET /admin/users?role=&status=&q=
Optional filters: `role` (`CUSTOMER`, `BUSINESS`, `ADMIN`), `status` (`ACTIVE`, `INACTIVE`, `BLOCKED`), `q` (part of name or email).
Newest first, max 200. `200` `{ "data": [ AdminUserDto ] }`.

### POST /admin/users/:id/status
Body `{ "status": "BLOCKED" | "ACTIVE" }`. A blocked user is refused by every route (`403 ACCOUNT_DISABLED`) and the mobile
app logs them out. `404 USER_NOT_FOUND`, `409 CANNOT_CHANGE_SELF`, `403 ADMIN_PROTECTED` (admins cannot be blocked here).

## Categories

The public list for the apps is `GET /categories` (active only, see `categories.md`). These are the admin routes.

### GET /admin/categories
All categories, including hidden ones, with `listingCount`. `200` `{ "data": [ AdminCategoryDto ] }`.

### POST /admin/categories
Body `{ "name", "description"?, "b2bSuitability"? }` (`SUITABLE` default, `RESTRICTED`, `UNSUITABLE`). `201` returns the category.
`409 NAME_TAKEN` (names are unique, ignoring upper/lower case).

### PATCH /admin/categories/:id
Send only what changes: `name`, `description`, `b2bSuitability`, `isActive` (false hides it from the apps; existing listings keep it).
`400` if the body is empty, `404 CATEGORY_NOT_FOUND`, `409 NAME_TAKEN`.

A listing with `audience: BUSINESSES_ONLY` must use a `SUITABLE` category (checked when the listing is created, Kajanika's module).

## Analytics

### GET /admin/analytics?days=30
`days` is `7`, `30` (default) or `90` (`400 VALIDATION_ERROR` otherwise). `200` `{ "data": AdminAnalyticsDto }`.
- `users`, `businesses`, `listings`: current totals by role or status.
- `reservations`, `impact`, `daily`, `topBusinesses`: only reservations created in the last `days` days.
- "Rescued" means a reservation that reached `PICKED_UP`. `itemsRescued` is the sum of their quantities, `revenueRecovered` the sum of their total prices (paid at pickup).
- `daily` has one entry per day (zeros included), dates in Sri Lanka time (UTC+05:30); `pickedUp` is how many of that day's reservations were picked up.
- `topBusinesses`: up to 5, by items rescued.

## Audit log

### GET /admin/audit-logs?action=&entityType=&cursor=&limit=30
Newest first. `limit` 1 to 100. `200` `{ "data": { items: AuditLogDto[], nextCursor: string | null, actions: string[] } }`.
Pass `nextCursor` back as `cursor` to get the next page. `actions` lists every action name that exists, for a filter.
Actions written today: `BUSINESS_APPROVED`, `BUSINESS_REJECTED`, `USER_BLOCKED`, `USER_UNBLOCKED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`.
Other modules may add rows with `prisma.auditLog.create` (use `UPPER_SNAKE_CASE` actions, `entityType` like `Listing`, and the entity id).

## Admin web dashboard

`/admin/login`, `/admin/analytics`, `/admin/businesses`, `/admin/users`, `/admin/categories`, `/admin/audit-log`. It needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) in `apps/web/.env`. Restart `npm run dev:web` after adding them.
