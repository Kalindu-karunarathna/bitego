# Categories API

Owner: Kalindu. Everyone uses `GET /categories` (listing form, filters, preferences).

## GET /categories  (public)

`200`
```json
{ "data": [
  { "id": "uuid", "name": "Bakery items", "description": "Bread, buns, cakes, pastries",
    "iconUrl": null, "b2bSuitability": "SUITABLE" }
] }
```
Only active categories, sorted by name. `b2bSuitability` is `SUITABLE`, `RESTRICTED` or `UNSUITABLE`:
a listing meant for businesses (`audience` BUSINESSES_ONLY) must use a `SUITABLE` category.

Type: `CategoryDto` in `@bitego/shared`.

## Seed data

`npm run db:seed -w @bitego/web` creates the categories. With `SEED_ADMIN_PASSWORD` in `apps/web/.env` it also creates
`admin@bitego.test`. With `SEED_DEMO_PASSWORD` it creates demo accounts (same password for all):

| Email | Role |
| --- | --- |
| demo.customer@bitego.test | CUSTOMER |
| demo.bakery@bitego.test | BUSINESS, Demo Bakery, Colombo, 3 listings (everyone / customers only / businesses only) |
| demo.cafe@bitego.test | BUSINESS, Demo Cafe, Kandy, 1 listing |

Run the seed again to make the demo listings available again (their pickup times are moved to the next few hours).
