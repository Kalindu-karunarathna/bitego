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

## Scheduled Background Jobs (Cron)

These endpoints run periodically (e.g. via Vercel Cron, GitHub Actions, or scheduled worker) to maintain system consistency.
Protected by `CRON_SECRET` sent via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>` header.

### GET or POST /cron/expire

Expires listings past their pickup deadline (`pickupEnd <= now()`) and marks uncollected reservations as `EXPIRED`, sending an in-app alert to the customer.

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
