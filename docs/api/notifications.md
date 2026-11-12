# Notifications & Preferences API

Owner: Sachira  
Base path: `/api/v1`

Every response uses one of two shapes:

```json
{ "data": { } }
{ "error": { "code": "SOME_CODE", "message": "Readable text", "details": [] } }
```

All routes require `Authorization: Bearer <token>` unless marked **(public)**.

---

## Notifications

### GET /notifications

List the authenticated user's notifications, newest first.

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `unread` | `"true"` \| `"false"` | — | Filter to unread only when `"true"` |
| `page` | integer ≥ 1 | `1` | Page number (20 items per page) |

**200 response**

```json
{
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "NEW_NEARBY_LISTING",
        "title": "New food near you",
        "message": "Sun Bakery posted 5 bread portions for LKR 50 each.",
        "isRead": false,
        "createdAt": "2026-11-05T07:00:00.000Z",
        "listingId": "uuid-or-null",
        "reservationId": null
      }
    ],
    "unreadCount": 3,
    "hasMore": false
  }
}
```

**Notification types**

| `type` | Sent to | Trigger |
|---|---|---|
| `NEW_NEARBY_LISTING` | Customer / B2B business | A new listing is posted near them (`onListingCreated`) |
| `NEW_RESERVATION` | Business (seller) | A customer reserves one of their listings |
| `RESERVATION_CONFIRMED` | Customer (buyer) | Their reservation is confirmed |
| `RESERVATION_CANCELLED` | Both parties | A reservation is cancelled or expired |
| `LISTING_NEARING_EXPIRY` | Business (seller) | Pickup window ends within 1 hour |
| `LISTING_SOLD_OUT` | Business (seller) | All quantity reserved |
| `PICKUP_REMINDER` | Customer (buyer) | Pickup window ends within 30 minutes |
| `BUSINESS_APPROVED` | Business owner | Admin approves the business |
| `BUSINESS_REJECTED` | Business owner | Admin rejects with remarks |

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing or invalid token |

---

### PATCH /notifications/:id/read

Mark a single notification as read. No request body needed.

**URL param:** `id` — UUID of the notification.

**200 response**

```json
{ "data": { "id": "uuid", "isRead": true } }
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 404 | `NOT_FOUND` | Notification not found or belongs to another user |

---

### POST /notifications/mark-all-read

Mark all of the authenticated user's notifications as read. No request body.

**200 response**

```json
{ "data": { "updatedCount": 5 } }
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing or invalid token |

---

### POST /notifications/push-token

Register a device push token after login (Expo push token). One user may have multiple devices.

**Request body**

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "ANDROID" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `token` | string | ✅ | Expo push token |
| `platform` | `"ANDROID"` \| `"IOS"` | ✅ | Device OS |

**200 response**

```json
{ "data": { "registered": true } }
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid token or platform |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |

---

### DELETE /notifications/push-token

Deregister a device push token on logout.

**Request body**

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

**200 response**

```json
{ "data": { "removed": true } }
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing token |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |

---

## Preferences

### GET /preferences

Return the authenticated user's notification preferences.

**200 response**

```json
{
  "data": {
    "notifyRadiusKm": 5,
    "notificationsEnabled": true,
    "approxLatitude": 6.92,
    "approxLongitude": 79.86,
    "locationUpdatedAt": "2026-11-04T10:00:00.000Z",
    "preferredCategories": [
      { "id": "uuid", "name": "Bakery" }
    ]
  }
}
```

> **Privacy note:** `approxLatitude` and `approxLongitude` are rounded to 2 decimal places (≈ 1.1 km accuracy) before storage. The exact location is never kept.

If the user has no saved preferences yet, defaults are returned:  
`notifyRadiusKm: 3`, `notificationsEnabled: true`, location fields `null`, `preferredCategories: []`.

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing or invalid token |

---

### PUT /preferences

Create or update preferences. All fields are optional — only the ones you send are changed.

**Request body**

```json
{
  "notifyRadiusKm": 10,
  "notificationsEnabled": true,
  "approxLatitude": 6.9271,
  "approxLongitude": 79.8612,
  "preferredCategoryIds": ["uuid-1", "uuid-2"]
}
```

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `notifyRadiusKm` | integer | 1–50 | Matching radius for new listings |
| `notificationsEnabled` | boolean | — | Master toggle |
| `approxLatitude` | number \| null | −90 to 90 | Send `null` to clear location |
| `approxLongitude` | number \| null | −180 to 180 | Send `null` to clear location |
| `preferredCategoryIds` | string[] (UUIDs) | max 20 | Replaces the full list; `[]` clears all |

**200 response** — the full updated preferences object (same shape as GET).

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | A field is out of range |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 404 | `CATEGORY_NOT_FOUND` | One of the category IDs does not exist |

---

## Nearby listing matching

`onListingCreated(listingId)` loads the listing and checks eligibility before finding recipients:

- The listing must be `ACTIVE`, have quantity available, and have a pickup deadline strictly later than the eligibility check. A future pickup start is allowed.
- Its business must be `ACTIVE`, its owner must be an active `BUSINESS` account, and its category must be active. Shop coordinates must be valid.
- Customers must have an active customer account, enabled notifications, and a complete valid saved approximate location. Missing preferences or a missing/cleared location means no nearby-listing alerts; there is no default geographic area. Empty category preferences accept all active categories; otherwise the category must match.
- Customers receive `CUSTOMERS_ONLY` and `EVERYONE` listings within their saved alert radius. The selling owner is excluded.
- B2B recipients must be other active businesses with active business owners and notifications enabled (enabled by default when no preference row exists). They receive `BUSINESSES_ONLY` and `EVERYONE` listings only when the category is `SUITABLE`.
- B2B matching measures from the registered shop location with a default 5 km radius. Customer-style favorite categories, approximate location, and saved radius do not apply to B2B matching.

Distance is calculated with Haversine and compared without rounding. Invalid coordinates cannot match. Customer distances remain approximate because saved location coordinates are rounded for privacy. This is straight-line proximity, not driving distance or pickup navigation.

Eligibility is checked from the listing snapshot; matching does not lock the listing through notification delivery. Recipients are deduplicated within one invocation. Repeated/concurrent invocations are not yet deduplicated across runs. This matching guard does not replace reservation-time authorization and B2B suitability checks in the buyer module.

Kajanika still needs to call the hook after listing creation commits successfully. That integration is owned by the seller module.

Run the matching regression tests from the repository root:

```powershell
node --test apps/web/src/server/modules/matching/matching.service.test.mjs apps/web/src/server/modules/matching/matching.test.mjs
```

These tests run the actual service/hook code with mocked database or matching/notification dependencies; no database writes or pushes occur. Live database and seller-flow integration still require separate verification.

---

## Scheduled Background Jobs (Cron)

These endpoints run periodically (e.g. via Vercel Cron, GitHub Actions, or scheduled worker) to maintain system consistency.
Protected by `CRON_SECRET` sent via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>` header.

### GET or POST /cron/expire

Expires past-due `ACTIVE` or `SOLD_OUT` listings and past-due `CONFIRMED` reservations. The job captures one cutoff time at the start; a pickup deadline equal to that time is expired.

Reservation eligibility is checked in the update itself. Only rows returned by that update contribute to `expiredReservationsCount` and receive an expiry notification attempt. A pickup or cancellation that changes the reservation first is preserved. Repeated or overlapping expiry runs do not claim an already-expired reservation again.

Notifications respect the user's preferences. Notification failures are logged and do not undo expiry or prevent attempts for other affected buyers. Delivery is not transactional with expiry: a failed notification or a process exit after the update is not retried by this job. The count reports status changes, not successful deliveries.

Run the focused regression tests from the repository root:

```powershell
node --test apps/web/src/server/modules/jobs/expiry.job.test.mjs
```

These tests execute the job with mocked database and notification dependencies, including competing status changes and overlapping runs. They do not replace a PostgreSQL concurrency integration test.

**200 response**

```json
{
  "data": {
    "expiredListingsCount": 2,
    "expiredReservationsCount": 1,
    "timestamp": "2026-10-29T06:30:00.000Z"
  }
}
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` | Invalid or missing cron secret |

---

### GET or POST /cron/remind

Scans for time-sensitive events and sends reminder notifications:
1. **Nearing Expiry**: Finds active listings expiring within 1 hour and sends `LISTING_NEARING_EXPIRY` to the seller.
2. **Pickup Deadline**: Finds confirmed reservations expiring within 30 minutes and sends `PICKUP_REMINDER` to the customer.

Deduplicated so recurring runs (e.g. every 5–15 minutes) only notify once per listing or reservation.

**200 response**

```json
{
  "data": {
    "nearingExpiryListingsNotified": 1,
    "pickupRemindersNotified": 2,
    "timestamp": "2026-11-01T07:00:00.000Z"
  }
}
```

**Errors**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` | Invalid or missing cron secret |

---

## Integration Guide for Teammates

Contract functions live in `src/server/modules/`:
- `notify(...)`: `src/server/modules/notifications/notify.ts`
- `onListingCreated(...)`: `src/server/modules/matching/matching.ts`

### 1. Kalindu (Admin Module)
Call `notify()` when a business is reviewed:

```ts
import { notify } from "@/server/modules/notifications/notify";

// When approved:
await notify({
  userId: business.ownerId,
  type: "BUSINESS_APPROVED",
  title: "Business approved",
  message: "Your business has been verified. You can now post surplus food.",
});

// When rejected:
await notify({
  userId: business.ownerId,
  type: "BUSINESS_REJECTED",
  title: "Business application rejected",
  message: remarks ? `Reason: ${remarks}` : "Your business application was not approved.",
});
```

### 2. Nistha (Buyer / Reservations Module)
Call `notify()` during reservation lifecycle events:

```ts
import { notify } from "@/server/modules/notifications/notify";

// When a customer makes a reservation:
// 1. Notify the business seller
await notify({
  userId: listing.business.ownerId,
  type: "NEW_RESERVATION",
  title: "New reservation",
  message: `${buyer.fullName} reserved ${reservation.quantity} item(s) from "${listing.title}".`,
  listingId: listing.id,
  reservationId: reservation.id,
});

// 2. Notify the buyer confirming their reservation
await notify({
  userId: buyer.id,
  type: "RESERVATION_CONFIRMED",
  title: "Reservation confirmed",
  message: `Your reservation for "${listing.title}" is confirmed. Pickup code: ${reservation.pickupCode}`,
  listingId: listing.id,
  reservationId: reservation.id,
});

// When a reservation is cancelled:
await notify({
  userId: targetUserId,
  type: "RESERVATION_CANCELLED",
  title: "Reservation cancelled",
  message: `Reservation for "${listing.title}" has been cancelled.`,
  listingId: listing.id,
  reservationId: reservation.id,
});
```

### 3. Kajanika (Seller / Listings Module)
Call `onListingCreated()` immediately after inserting a new listing:

```ts
import { onListingCreated } from "@/server/modules/matching/matching";

// Fire-and-forget: do NOT await this in the response path
void onListingCreated(listing.id);
```

When all portions of a listing are reserved:
```ts
await notify({
  userId: business.ownerId,
  type: "LISTING_SOLD_OUT",
  title: "Listing sold out",
  message: `All portions of "${listing.title}" have been reserved.`,
  listingId: listing.id,
});
```

---

## Testing with curl

### 1. List Notifications
```bash
curl -X GET "http://localhost:3000/api/v1/notifications?page=1&unread=true" \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. Mark One as Read
```bash
curl -X PATCH "http://localhost:3000/api/v1/notifications/<NOTIFICATION_ID>/read" \
  -H "Authorization: Bearer <TOKEN>"
```

### 3. Mark All as Read
```bash
curl -X POST "http://localhost:3000/api/v1/notifications/mark-all-read" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4. Get Preferences
```bash
curl -X GET "http://localhost:3000/api/v1/preferences" \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Update Preferences
```bash
curl -X PUT "http://localhost:3000/api/v1/preferences" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "notifyRadiusKm": 5,
    "notificationsEnabled": true,
    "approxLatitude": 6.9271,
    "approxLongitude": 79.8612,
    "preferredCategoryIds": []
  }'
```

### 6. Trigger Expiry Cron Job
```bash
curl -X POST "http://localhost:3000/api/v1/cron/expire" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### 7. Trigger Reminders Cron Job
```bash
curl -X POST "http://localhost:3000/api/v1/cron/remind" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### 8. Register Device Push Token
```bash
curl -X POST "http://localhost:3000/api/v1/notifications/push-token" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "ANDROID"
  }'
```

### 9. Remove Device Push Token (Logout)
```bash
# Via JSON request body:
curl -X DELETE "http://localhost:3000/api/v1/notifications/push-token" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  }'

# Or via query parameter:
curl -X DELETE "http://localhost:3000/api/v1/notifications/push-token?token=ExponentPushToken%5Bxxxxxxxxxxxxxxxxxxxxxx%5D" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Mobile Push Token Registration Flow

### Overview
The mobile app automatically registers the device's Expo push token upon mounting the notifications screen (or after user login) via `usePushRegistration`.

### Lifecycle
1. **Permission Check**: Requests notification permission from the OS (`requestPermissionsAsync`).
2. **Channel Setup (Android)**: Configures high-importance notification channel (`bitego_default`) with custom accent color (`#E65100`).
3. **Token Generation**: Obtains Expo push token (`ExponentPushToken[...]`).
4. **Backend Sync**: Dispatches `POST /api/v1/notifications/push-token` with `{ token, platform }`.
5. **Logout Cleanup**: On user sign-out, dispatches `DELETE /api/v1/notifications/push-token` with `{ token }` to deregister the device.
6. **Web & Simulator Fallback**: Gracefully marks status as `unsupported` on Web without crashing, and provides fallback token in development.

---

## Backend Push Delivery & Dispatch Pipeline

### Overview
Whenever `notify()` is invoked (by reservation confirmation, new nearby listing matching, reminder jobs, or business verification), it:
1. Checks the recipient's master notification toggle (`UserPreference.notificationsEnabled`).
2. Persists the in-app notification row in the PostgreSQL database.
3. Automatically dispatches asynchronous, fire-and-forget push notifications via `sendPush(userId, payload)` to all active devices registered by that user.

### Stale Token Pruning (`DeviceNotRegistered`)
When a user uninstalls the mobile app, Expo's Push API returns an error ticket with:
```json
{
  "status": "error",
  "message": "\"ExponentPushToken[...]\" is not a registered push token.",
  "details": { "error": "DeviceNotRegistered" }
}
```
The `sendPush` function detects `DeviceNotRegistered` errors in the delivery response and immediately purges those tokens from the `device_tokens` table (`prisma.deviceToken.deleteMany`), preventing future unneeded calls.

---

## Reservation Pickup Map (Section 4)

Owner: Sachira. The reusable component is in
`apps/mobile/src/features/notifications/BusinessLocationMap.tsx` with a separate web implementation.
This section implements the embedded map and its route API. It does not implement
Nistha's reservation list, pickup-details screen, QR code, pickup actions, or status timeline.
The Google Maps **Get directions** action is Section 5; the previous shop-search button
is no longer rendered by this component. Its old utility is not the new navigation contract.

### Integration for Nistha: selected reservation's pickup details

Mount the component only when the customer opens **Pickup details** for that order.
Do not mount a route map in every reservation-list card: mounting requests GPS and a route.
Unmount it when the details close. Pass the real reservation UUID, not the display/pickup code.

```tsx
import { BusinessLocationMap } from "@/features/notifications/BusinessLocationMap";

// Inside the selected reservation's pickup details (adapt data names to your API):
<BusinessLocationMap
  key={reservation.id}
  reservationId={reservation.id}
  latitude={reservation.listing.business.latitude}
  longitude={reservation.listing.business.longitude}
  name={reservation.listing.business.name}
  address={reservation.listing.business.addressLine}
/>
```

The screen must supply the selected reservation's shop data. The route endpoint independently
checks ownership and loads the destination from the database. Its returned shop coordinates
replace the initial pin position, so an outdated screen value does not change the route destination.
No buyer screen currently imports this component; this integration remains Nistha's work.

| Prop | Default | Meaning |
| --- | --- | --- |
| `reservationId` | Required for the default loader | Authenticated buyer's reservation UUID |
| `latitude`, `longitude` | Required | Initial shop pin; invalid coordinates show an error |
| `name`, `address` | Name required | Shop label and optional address |
| `userLatitude`, `userLongitude` | Omitted | Supply both only if already holding current customer coordinates; otherwise request foreground GPS |
| `height` | `240` | Map height |
| `interactive` | `false` | Enable map gestures when desired inside the scrollable pickup screen |
| `loadRoute` | Authenticated route API | Optional stable callback for tests or integration; returns validated Google route geometry, destination, metres, seconds |

The customer pin is blue; the shop pin and driving route are orange. Bounds include both
locations and the road geometry. Distance is road distance; duration is Google's driving
estimate without live traffic. There is no straight-line route or walking-time fallback.
The map is a snapshot, not continuous navigation: **Refresh route** reacquires GPS when
coordinates were not supplied. Supplied coordinates must be refreshed by the parent screen.

Permission, GPS, and route waits are bounded (30, 20, and 15 seconds). Failures show a message
and retry action. Switching orders, changing coordinates, retrying, and unmounting invalidate
old results. The existing API client's network request cannot be externally cancelled;
its late result is ignored, while the backend bounds the Google request to 10 seconds.
This component does not save precise GPS positions to customer preferences or the database.

### POST /api/v1/notifications/pickup-route

Uses the existing Bearer authentication and `{ data }` / `{ error }` API format.
Allowed roles: CUSTOMER and BUSINESS (buyer). Only the caller's CONFIRMED reservation
with a future pickup deadline can be routed. Completed, cancelled, and expired pickups
are rejected. No destination or buyer ID is accepted from the client.

Request:
```json
{
  "reservationId": "2f2da038-3fef-4b35-a629-258236d6bc8c",
  "origin": { "latitude": 6.9, "longitude": 79.85 }
}
```

Response data (illustrative values):
```json
{
  "destination": { "latitude": 6.91, "longitude": 79.86 },
  "coordinates": [
    { "latitude": 6.9, "longitude": 79.85 },
    { "latitude": 6.91, "longitude": 79.86 }
  ],
  "distanceMeters": 1500,
  "durationSeconds": 320.5
}
```

Actual coordinates come from Google's GeoJSON LineString; longitude/latitude pairs are
converted to the app's coordinate shape. The full route is displayed, not a line invented
between the two example points. The API does not store routes or retry billable requests.
Successful responses set `Cache-Control: private, no-store`; provider fetches use `no-store`.

| Status / code | Meaning |
| --- | --- |
| 400 / VALIDATION_ERROR | Invalid reservation UUID or origin, or unexpected request fields |
| 401 / 403 | Existing authentication/role checks failed |
| 404 / RESERVATION_NOT_FOUND | Missing order or another buyer's order |
| 409 / PICKUP_UNAVAILABLE | Reservation is no longer available for pickup |
| 422 / SHOP_LOCATION_UNAVAILABLE | Stored shop coordinates are invalid |
| 503 / ROUTING_NOT_CONFIGURED | Server key is missing or blank |
| 404 / ROUTE_NOT_FOUND | Google found no driving route |
| 502 / INVALID_ROUTE or ROUTING_UNAVAILABLE | Invalid response or provider/network failure |
| 504 / ROUTING_TIMEOUT | Google request exceeded the server timeout |

### Configuration handoff for Kalindu (not changed in Section 4)

1. Enable Google Routes API and billing; provide `GOOGLE_ROUTES_API_KEY` only to the web
   backend environment. Restrict this key to Routes API and the applicable server restrictions.
   Never put it in an `EXPO_PUBLIC_*` variable or send it to the app.
2. Configure separate restricted Maps SDK keys for Android and iOS in the
   `react-native-maps` Expo plugin and create a new development/production native build.
   The component explicitly uses `PROVIDER_GOOGLE` on both platforms. The current app config
   does not yet configure these Google Maps keys. Follow the installed SDK's configuration
   instructions: [Expo SDK 58 react-native-maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/).
3. For Expo Web, enable Maps JavaScript API and set
   `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` to a browser/referrer-restricted key. Set
   `EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID` to your web map ID for production; `DEMO_MAP_ID`
   is the development default. Without a web key the component shows unavailable and makes
   no GPS or route request. Serve over HTTPS (or localhost) for browser geolocation.
4. Keep foreground location permission configured. No background tracking is used.
   Existing `expo-location` configuration already includes a foreground permission explanation;
   review the wording for pickup navigation when preparing the build.
5. Set project quotas appropriate to expected map/route usage before live integration testing.
   Each map mount or explicit refresh can request a route. There is no automatic route polling.
   Web pin/route updates reuse the existing map instance; a user retry reloads the map.

The implementation follows [Google computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
and renders its geometry on Google Maps on each platform. Google keys, billing settings,
platform configuration, dependencies, reservation screens, and database schema were not changed.
No live Google requests were made during this section's automated verification.

### Verification

Run from the repository root:
```powershell
node --test apps/web/src/server/modules/notifications/pickup-route.service.test.mjs
node --test apps/mobile/src/features/notifications/pickupRoute.test.mjs apps/mobile/src/features/notifications/pickupMapDocument.test.mjs
npm run typecheck -w @bitego/web
npm run typecheck -w @bitego/mobile
```

The focused tests execute the real TypeScript service, hook, validators, and iframe script with
mocked database, authentication, GPS, and Google boundaries. They cover reservation ownership,
closed pickups, coordinate validation, provider errors/timeouts, zero distance, retries, stale
order/GPS responses, safe HTML data embedding, and web updates without map re-creation.
They do not verify native map rendering, live credentials, or real road accuracy.

After configuration and screen integration, manually verify on Android, iOS, and Web:
open one order's Pickup details; allow GPS; see two pins, a road route, road distance, and driving
duration; switch orders while loading; deny GPS; simulate offline/no-route; and retry.
Check that the route belongs to the selected order and that map bounds show both endpoints.
