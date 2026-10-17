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
| `RESERVATION_CANCELLED` | Both parties | A reservation is cancelled |
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

## For module developers

```ts
// Calling notify() — anyone may import and await this.
import { notify } from "@/server/modules/notifications/notify";

await notify({
  userId: user.id,
  type: "NEW_RESERVATION",
  title: "New reservation",
  message: `${buyer.fullName} reserved 2 portions of your listing.`,
  listingId: listing.id,
  reservationId: reservation.id,
});
```

```ts
// Calling onListingCreated() — Kajanika calls this after creating a listing.
import { onListingCreated } from "@/server/modules/matching/matching";

void onListingCreated(listing.id); // fire-and-forget, do not await
```

