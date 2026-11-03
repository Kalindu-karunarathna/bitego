# BiteGo: work division

Goal: four people build in parallel and almost never edit the same file. Every file has exactly one owner. If you need a change in a file you do not own, ask the owner (or open a small PR the owner approves). Do not edit it yourself.

## 1. Who builds what

| Person | Area | One-line summary |
| --- | --- | --- |
| **Kalindu** | Admin and platform | Admin web dashboard + admin API, users, categories, reports, analytics, auth/profile, database schema, CI, deployment, integration |
| **Kajanika** | Seller side | Business profile, creating and managing listings, photo upload, the seller's orders and pickup-code check |
| **Nistha** | Buyer side | Discovering food (search, filters, distance), listing detail, reservations, pickup code, reviews. Used by customers and by businesses buying (B2B) |
| **Sachira** | Notifications and background | Notifications, push, matching, user preferences, scheduled jobs (expiry, reminders) |

### Kalindu: admin and platform
- **Admin web** (`apps/web/src/app/(admin)/admin/**`): dashboard, business approval queue (approve / reject with remarks), users (suspend / activate), categories (add / edit / hide), listings moderation (force cancel), reservations overview, reports moderation, analytics (food saved, reservations per day, top businesses), audit log.
- **Admin API**: `apps/web/src/app/api/v1/admin/**`, `.../users/**`, `.../categories/**` (including the public `GET /categories` that everyone uses), `.../reports/**` (customers and businesses can report a listing). Logic in `server/modules/{admin,users,reports,analytics}`.
- **Platform**: `prisma/schema.prisma`, migrations and seed, CI, deployment, docs/architecture, code review and merging, integration testing.
- **Mobile**: `app/_layout.tsx`, `(auth)`, customer account tab (`(customer)/account/index.tsx`), pending-approval, `features/auth`, `features/profile`, `features/reports` (a `ReportButton` that others place on the listing detail screen), `components/ui.tsx`, `lib/*`, `api/client.ts`.

### Kajanika: seller side
- **API** under a new prefix `apps/web/src/app/api/v1/seller/**` plus `.../businesses/**` (public business profile) and `.../uploads/**`. Logic in `server/modules/{businesses,listings,orders,uploads}`.
  - Create, edit, cancel a listing; list my listings; add photos (camera upload).
  - Edit the business profile and shop location.
  - List reservations on my listings and verify a pickup code (marks the reservation PICKED_UP).
- **Mobile**: `(business)/sell/**`, `(business)/orders/**`, `(business)/shop/**`, `features/listings`, `features/shop`, `src/api/seller.ts`.

### Nistha: buyer side
- **API**: `apps/web/src/app/api/v1/listings/**` (read only: search, filters, distance, detail), `.../reservations/**` (create, cancel, my reservations), `.../reviews/**`. Logic in `server/modules/{discovery,reservations,reviews}`.
  - Distance search with the haversine formula on business latitude/longitude. Respect `audience`: customers see CUSTOMERS_ONLY and EVERYONE, businesses see BUSINESSES_ONLY and EVERYONE.
  - Reservation: atomic quantity update, unique 6-character pickup code, one active reservation per buyer per listing.
- **Mobile**: `(customer)/discover/**`, `(customer)/reservations/**`, `(business)/buy/**` (the same discovery screens with the business audience), `features/{discovery,reservations,reviews}`, `src/api/{discovery,reservations}.ts`.

### Sachira: notifications and background work
- **API**: `apps/web/src/app/api/v1/notifications/**` (list, mark read, register push token), `.../preferences/**` (new: radius, categories, optional approximate location), `.../cron/**` (new: scheduled jobs). Logic in `server/modules/{notifications,matching,preferences,jobs}`.
  - Matching: when a listing is created, find customers (preferences + distance) and businesses (B2B-suitable categories) and notify them.
  - Jobs: expire listings and reservations past their time, "nearing expiry" and pickup reminders.
- **Mobile**: `(customer)/notifications/**`, `(business)/notifications/**`, `features/{notifications,preferences}`, `(customer)/account/preferences.tsx`, push registration, `src/api/{notifications,preferences}.ts`.
- Note: remote push on Android does not work inside Expo Go in recent SDKs. Plan to test push in a development build (`eas build --profile development`) and Firebase (FCM) credentials. Build in-app notifications first; push comes second.

## 2. Contracts between people (these connect the areas)

Nobody waits for anybody: each person calls the function below even before its owner has finished it, because the scaffold already contains a do-nothing version.

| Contract | Owner | Used by | How |
| --- | --- | --- | --- |
| `notify({ userId, type, title, message, listingId?, reservationId? })` in `server/modules/notifications/notify.ts` | Sachira | Nistha (reservation events), Kajanika (pickup done), Kalindu (business approved/rejected) | Import and `await notify(...)`. Sachira replaces the body later (save + push). |
| `onListingCreated(listingId)` in `server/modules/matching/matching.ts` | Sachira | Kajanika | Call it after a listing is created. |
| `GET /api/v1/categories` | Kalindu | Kajanika (listing form), Nistha (filters), Sachira (preferences) | Returns visible categories with `b2bSuitability`. |
| Reservation status flow | Nistha creates and cancels, Kajanika marks PICKED_UP, Sachira's job marks EXPIRED | all | `CONFIRMED -> PICKED_UP`, `CONFIRMED -> CANCELLED`, `CONFIRMED -> EXPIRED`. Only these. |
| `ReportButton` in `features/reports` | Kalindu | Nistha (places it on listing detail) | `<ReportButton listingId={id} />` |
| Sample data in the seed | Kalindu | everyone | Phase 0: a few categories, an admin, a business and listings, so nobody waits for the seller screens to test. |

## 3. Files that only Kalindu changes (shared hotspots)

Most merge conflicts come from these. The scaffold has already prepared them so you rarely need to touch them.

- `apps/web/prisma/schema.prisma`, migrations, seed: need a table or column change? Message Kalindu with exactly what you need. He changes it, merges the same day, you merge `main`.
- `packages/shared/src/index.ts`, `constants.ts`, `auth.ts`, `api-types.ts`: already export one file per person (below). Put your types in your own file.
- Root and workspace `package.json` and `package-lock.json`: see the rule in section 5.
- `components/ui.tsx`, `lib/theme.ts`, `app/_layout.tsx`, the tab `_layout.tsx` files. Every tab is a folder with its own Stack `_layout.tsx` that its owner controls, so new screens inside a tab need no changes elsewhere.
- CI, `.github`, root config.

Your own shared-types file:
`packages/shared/src/`: Kalindu `admin.ts`, Kajanika `seller.ts`, Nistha `discovery.ts` and `reservations.ts`, Sachira `notifications.ts` and `preferences.ts`.

## 4. Folder ownership map

| Path | Owner |
| --- | --- |
| `apps/web/src/app/(admin)/**`, `app/api/v1/{admin,users,categories,reports}/**` | Kalindu |
| `apps/web/src/server/modules/{admin,users,reports,analytics,auth}/**` | Kalindu |
| `apps/web/src/app/api/v1/{seller,businesses,uploads}/**` | Kajanika |
| `apps/web/src/server/modules/{businesses,listings,orders,uploads}/**` | Kajanika |
| `apps/web/src/app/api/v1/{listings,reservations,reviews}/**` | Nistha |
| `apps/web/src/server/modules/{discovery,reservations,reviews}/**` | Nistha |
| `apps/web/src/app/api/v1/{notifications,preferences,cron}/**` | Sachira |
| `apps/web/src/server/modules/{notifications,matching,preferences,jobs}/**` | Sachira |
| `apps/mobile/app/(customer)/{discover,reservations}/**`, `app/(business)/buy/**` | Nistha |
| `apps/mobile/app/(business)/{sell,orders,shop}/**` | Kajanika |
| `apps/mobile/app/(customer)/notifications/**`, `app/(business)/notifications/**` | Sachira |
| `apps/mobile/app/(customer)/account/index.tsx`, `app/(auth)/**`, root files | Kalindu |
| `apps/mobile/src/features/<your area>/**` and `src/api/<your area>.ts` | the area's owner |
| `docs/api/<area>.md` | the area's owner |

## 5. Working rules

1. **Branches**: `feature/<name>-<thing>`, e.g. `feature/nistha-reservations`. Small PRs (under about 400 lines) into `main`. Kalindu reviews and merges.
2. **Merge `main` every morning** and before you open a PR: `git fetch upstream && git merge upstream/main && npm install`.
3. **Stay in your folders.** Outside your own paths, ask first.
4. **Lock file conflicts**: if `package-lock.json` conflicts, take `main`'s version (`git checkout upstream/main -- package-lock.json`), then run `npm install` and commit. Add new packages in a small PR of their own and merge it quickly.
5. **Contract first**: your first PR (within 1 to 2 days) contains `docs/api/<area>.md` and your types in `packages/shared`. Others code against it while you build the rest.
6. **One response shape**: `{data}` or `{error:{code,message}}`. Use `route()`, `ApiError`, `requireRole` and `parseBody` from the backend foundation; use `apiFetch` on mobile.
7. **No reformatting** files you do not own, and no renaming or moving folders.
8. **Do not call another person's database tables for writes.** Reading any table with Prisma is fine; writing a table you do not own goes through its owner's service function.

## 6. Order of work

- **Phase 0 (Kalindu, first):** merge this scaffold, extend the seed with sample data, confirm everyone can run backend and mobile.
- **Phase 1 (parallel):** each person's contract PR, then their main features.
- **Phase 2 (integration, everyone):** wire the contracts (`onListingCreated`, `notify`, `ReportButton`, categories), then test end to end: business registers, admin approves, business posts, customer finds and reserves, business verifies the code, notifications arrive, report goes to the admin.
