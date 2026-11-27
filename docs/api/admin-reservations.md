# Admin reservations overview

Read-only list of every reservation, for checking disputes and for the demo. Owner: Kalindu.

`GET /api/v1/admin/reservations` (admin only)

| Query | Meaning |
|---|---|
| `status` | `ALL` (default), `CONFIRMED`, `PICKED_UP`, `CANCELLED`, `EXPIRED` |
| `search` | text, matches pickup code, buyer name or email, listing title or business name (case-insensitive) |
| `cursor` | the `nextCursor` of the previous page |
| `limit` | 1 to 100, default 30 |

Newest first. Response:

```json
{ "data": {
  "items": [ { "id": "uuid", "status": "CANCELLED", "quantity": 2, "totalPrice": 80, "pickupCode": "AB12CD",
               "createdAt": "...", "pickedUpAt": null, "cancelledAt": "...", "cancelReason": "Changed my mind",
               "buyer": { "id": "...", "fullName": "...", "email": "..." },
               "listing": { "id": "...", "title": "...", "business": { "id": "...", "name": "..." } } } ],
  "nextCursor": "uuid-or-null",
  "counts": { "ALL": 40, "CONFIRMED": 10, "PICKED_UP": 10, "CANCELLED": 10, "EXPIRED": 10 }
} }
```

`counts` ignores the search text, so the tabs always show the real totals. Nothing here changes data.
