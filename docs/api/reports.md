# Reports API

A user reports a food listing. An admin reviews the report. Owner: Kalindu.

## Report a listing (any signed-in user)

`POST /api/v1/reports`

```json
{ "listingId": "uuid", "type": "QUALITY_SAFETY", "description": "Smelled sour" }
```

`type` is one of `QUALITY_SAFETY`, `FAKE`, `INAPPROPRIATE`, `SPAM`, `OTHER`. `description` is optional (max 500).
Response `201`: `{ "data": { "id": "uuid", "status": "PENDING" } }`

| Code | Status | When |
|---|---|---|
| `LISTING_NOT_FOUND` | 404 | the listing does not exist |
| `CANNOT_REPORT_OWN_LISTING` | 403 | the caller owns the listing's business |
| `ALREADY_REPORTED` | 409 | the caller already has an open report on this listing |

In the mobile app use `<ReportButton listingId={id} />` (`src/features/reports/ReportButton.tsx`). It is already on the customer listing screen.

## Admin: list reports

`GET /api/v1/admin/reports?status=PENDING|RESOLVED|REJECTED|ALL` (default `PENDING`). Pending reports are oldest first, the rest newest first. Max 200.

## Admin: decide a report

`POST /api/v1/admin/reports/:id/review`

```json
{ "action": "HIDE_LISTING", "note": "Confirmed bad batch" }
```

| action | What happens | Report becomes |
|---|---|---|
| `DISMISS` | nothing changes | `REJECTED` |
| `RESOLVE` | nothing changes (handled outside the app) | `RESOLVED` |
| `HIDE_LISTING` | listing is cancelled, its confirmed reservations are cancelled and the buyers are notified | `RESOLVED` |
| `BLOCK_BUSINESS` | business becomes `SUSPENDED`, the owner is `BLOCKED`, all open listings are cancelled, buyers are notified | `RESOLVED` |

`HIDE_LISTING` and `BLOCK_BUSINESS` also close the other pending reports on the same listing(s).
Everything happens in one transaction, so a failed action leaves the report `PENDING`.
Every decision is written to the audit log (`REPORT_RESOLVED`, `REPORT_DISMISSED`, `LISTING_HIDDEN_BY_ADMIN`, `BUSINESS_SUSPENDED`, `USER_BLOCKED`).

| Code | Status | When |
|---|---|---|
| `REPORT_NOT_FOUND` | 404 | unknown report id |
| `REPORT_ALREADY_HANDLED` | 409 | the report is no longer `PENDING` |
| `CANNOT_CHANGE_SELF` | 409 | the business owner is the admin |

The reporter and the seller do not get a notification yet (there is no notification type for it).
