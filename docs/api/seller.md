# Seller API

Owner: Kajanika. Types and schemas are in `@bitego/shared` (`seller.ts`). Responses use `{data}` / `{error}` as in `auth.md`.

Every `/seller/*` and `/uploads/*` route needs `Authorization: Bearer <token>` of an approved business:
`401 UNAUTHENTICATED`, `403 FORBIDDEN` (not a business), `403 BUSINESS_NOT_APPROVED`. Invalid input is `400 VALIDATION_ERROR`, with `details` listing each field.
A business can only see and change its own data; anything else is `404`.

## Listings

### GET /seller/listings?status=ALL
`status` is `ACTIVE`, `SOLD_OUT`, `COMPLETED`, `EXPIRED`, `CANCELLED` or `ALL` (default). Newest first, max 200.
`200` `{ "data": [ SellerListingDto ] }`

```json
{
  "id": "uuid", "title": "Rice & Curry", "description": "Two curries and dhal",
  "category": { "id": "uuid", "name": "Prepared meals" },
  "quantityTotal": 10, "quantityAvailable": 4, "unit": "PORTION",
  "originalPrice": 380, "price": 220,
  "pickupStart": "2026-11-07T14:30:00.000Z", "pickupEnd": "2026-11-07T15:30:00.000Z", "pickupNote": null,
  "audience": "EVERYONE", "status": "ACTIVE",
  "images": [ { "id": "uuid", "imageUrl": "https://...", "isPrimary": true, "displayOrder": 0 } ],
  "reservations": { "active": 2, "pickedUp": 1 },
  "createdAt": "...", "updatedAt": "..."
}
```

A listing past its `pickupEnd` is reported as `EXPIRED` even if the background job has not updated it yet.

### POST /seller/listings
```json
{
  "categoryId": "uuid", "title": "Rice & Curry", "description": "optional",
  "quantityTotal": 10, "unit": "PORTION", "originalPrice": 380, "price": 220,
  "pickupStart": "2026-11-07T14:30:00.000Z", "pickupEnd": "2026-11-07T15:30:00.000Z", "pickupNote": "optional",
  "audience": "EVERYONE", "imageKeys": ["keys from POST /uploads/listing-images"]
}
```
Free food is `price: 0`. `price` cannot be higher than `originalPrice`. `pickupEnd` must be after `pickupStart` and in the future.
`201` the listing. `onListingCreated(listing.id)` is then called, so matching can notify buyers.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `CATEGORY_NOT_AVAILABLE` | category is missing or hidden |
| 400 | `CATEGORY_NOT_B2B_SUITABLE` | `BUSINESSES_ONLY` needs a `SUITABLE` category |
| 400 | `PICKUP_ALREADY_ENDED` | `pickupEnd` is in the past |
| 400 | `INVALID_IMAGE` | a key does not belong to this business |

### GET /seller/listings/:id
`200` the listing. `404 LISTING_NOT_FOUND`.

### PATCH /seller/listings/:id
Send only what changes; `description` and `pickupNote` may be `null`. Only `ACTIVE` and `SOLD_OUT` listings can change.

- `quantityTotal` cannot go below what is already reserved. Status moves between `ACTIVE` and `SOLD_OUT` to match.
- With active reservations, the pickup window can only be extended, so buyers keep the time they were promised.
- Existing reservations keep the price they were booked at.

`200` the listing. Errors as for create, plus:

| Status | Code | Meaning |
| --- | --- | --- |
| 404 | `LISTING_NOT_FOUND` | |
| 409 | `LISTING_NOT_EDITABLE` | sold out listings can change; expired, completed or cancelled ones cannot |
| 409 | `QUANTITY_BELOW_RESERVED` | `details.reserved` is the minimum |
| 409 | `PICKUP_WINDOW_LOCKED` | the change would shorten the window while reservations are active |
| 409 | `LISTING_CHANGED` | someone reserved at the same moment; try again |
| 400 | `INVALID_PRICE`, `INVALID_PICKUP_WINDOW` | the merged values break the rules above |

### POST /seller/listings/:id/cancel
Body `{ "reason": "optional" }`. An `ACTIVE` or `SOLD_OUT` listing becomes `CANCELLED`. Its `CONFIRMED` reservations become `CANCELLED`
and each buyer gets a `RESERVATION_CANCELLED` notification. `200` the listing. `404 LISTING_NOT_FOUND`, `409 LISTING_NOT_EDITABLE`.

### POST /seller/listings/:id/images
Body `{ "key": "key from POST /uploads/listing-images" }`, adds a photo after the listing exists. At most 5. The first photo becomes primary.
`201` the listing. `400 INVALID_IMAGE`, `404 LISTING_NOT_FOUND`, `409 LISTING_NOT_EDITABLE`, `409 TOO_MANY_IMAGES`.

### DELETE /seller/listings/:id/images/:imageId
Removes a photo. If it was primary, the next photo becomes primary. `200` the listing. `404 IMAGE_NOT_FOUND`, `404 LISTING_NOT_FOUND`, `409 LISTING_NOT_EDITABLE`.

## Photo upload

Photos go straight from the phone to S3, so they never pass through the API.

1. `POST /uploads/listing-images` with `{ "contentType": "image/jpeg" }` (`image/png` and `image/webp` also work).
   `201` `{ "data": { "key", "imageUrl", "uploadUrl", "fields": { }, "maxBytes": 5242880 } }`
2. Send a multipart `POST` to `uploadUrl`: every entry of `fields`, then the photo as `file`. The link lasts 5 minutes. S3 refuses files over `maxBytes`.
3. Send `key` in `imageKeys` when creating the listing, or to `POST /seller/listings/:id/images`.

`503 UPLOADS_NOT_CONFIGURED` when the `AWS_*` values are missing from `apps/web/.env`.

**S3 setup:** buyers load photos directly from `imageUrl`, so the bucket must allow public `GetObject` on `listings/*`.
The bucket also needs a CORS rule if photos are uploaded from the Expo web build. The access key needs `s3:PutObject` and `s3:DeleteObject`.

## Business profile

### GET /seller/business
`200` `SellerBusinessDto`: the profile plus `stats { activeListings, itemsRescued, averageRating, reviewCount }`.

### PATCH /seller/business
Send only what changes: `name`, `type`, `description`, `contactNo`, `email`, `addressLine`, `city`, `district`, `latitude` + `longitude` (always together).
`description`, `email` and `district` may be `null`. `200` `SellerBusinessDto`. The registration number cannot be changed here.

### GET /businesses/:id  (public)
`200` `PublicBusinessDto`: public details of an `ACTIVE` business with `averageRating` and `reviewCount`. `404 BUSINESS_NOT_FOUND`.

## Orders

### GET /seller/orders?status=ALL&listingId=
`status` is `CONFIRMED`, `PICKED_UP`, `CANCELLED`, `EXPIRED` or `ALL` (default). `listingId` is optional. Max 200.
`CONFIRMED` is soonest pickup first; the others are newest first.
`200` `{ "data": [ SellerOrderDto ] }`

```json
{
  "id": "uuid", "quantity": 2, "unitPrice": 220, "totalPrice": 440, "status": "CONFIRMED",
  "pickedUpAt": null, "cancelledAt": null, "cancelReason": null, "createdAt": "...",
  "buyer": { "fullName": "Nimal Perera", "isBusiness": false, "phone": "0771234567" },
  "listing": { "id": "uuid", "title": "Rice & Curry", "unit": "PORTION", "pickupStart": "...", "pickupEnd": "...", "imageUrl": "https://..." }
}
```

The pickup code is never returned here: the seller must get it from the buyer. `buyer.phone` is shared so the seller can call about the pickup (`null` if the buyer gave none).

### GET /seller/orders/:id
`200` `SellerOrderDto`. `404 ORDER_NOT_FOUND`.

### POST /seller/orders/verify
Body `{ "code": "BG4821" }`: 6 letters or digits, lowercase accepted. Checks the code and changes nothing, so the seller can see what to hand over and how much to collect.
`200` `SellerOrderDto`.

### POST /seller/orders/confirm-pickup
Body `{ "code": "BG4821" }`. Marks the reservation `PICKED_UP`. When a sold-out listing has no `CONFIRMED` reservations left, it becomes `COMPLETED`.
`200` `SellerOrderDto`.

Both routes:

| Status | Code | Meaning |
| --- | --- | --- |
| 404 | `INVALID_CODE` | no such code on this business's listings |
| 409 | `ALREADY_PICKED_UP` | this reservation was already collected |
| 409 | `RESERVATION_NOT_ACTIVE` | cancelled or expired |

**For Nistha:** pickup codes must be saved as exactly 6 uppercase letters or digits to work with these routes.

## Activity

### GET /seller/activity?period=MONTH
`period` is `TODAY`, `WEEK` (last 7 days) or `MONTH` (this calendar month, default). Days are in Sri Lanka time.
`200` `SellerActivityDto`: `listingsCreated`, `portionsReserved` (cancelled excluded), `portionsCollected`, `portionsAwaiting`, `portionsCancelled`,
`revenue` (paid at pickup), `completionRate` (% of portions reserved in the period that were collected, or `null`), `previous*` values for the same
length of time just before, `last7Days` (`{ date, collected }`) and `revenueByListing` (top 5).

## Audit log actions

`LISTING_CREATED`, `LISTING_UPDATED`, `LISTING_CANCELLED`, `BUSINESS_PROFILE_UPDATED`, `RESERVATION_PICKED_UP`.
