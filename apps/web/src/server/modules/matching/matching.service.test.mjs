import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("./matching.service.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const NOW = new Date("2026-11-12T10:00:00Z");

function listing() {
  return {
    id: "food", title: "Bread", price: "50.00", categoryId: "bakery", audience: "EVERYONE",
    businessId: "seller", status: "ACTIVE", quantityAvailable: 1,
    pickupStart: new Date(NOW.getTime() + 60000), pickupEnd: new Date(NOW.getTime() + 120000),
    business: { id: "seller", name: "Bakery", latitude: 0, longitude: 0, ownerId: "seller-owner", status: "ACTIVE", owner: { status: "ACTIVE", role: "BUSINESS" } },
    category: { id: "bakery", name: "Bakery", b2bSuitability: "SUITABLE", isActive: true },
  };
}
function customer(id = "customer", preference = {}) {
  return { id, role: "CUSTOMER", status: "ACTIVE", preference: {
    notificationsEnabled: true, notifyRadiusKm: 3, approxLatitude: 0, approxLongitude: 0,
    preferredCategories: [], ...preference,
  } };
}
function business(id = "buyer") {
  return { id, ownerId: `${id}-owner`, status: "ACTIVE", latitude: 0, longitude: 0,
    owner: { role: "BUSINESS", status: "ACTIVE", preference: null } };
}
// Minimal query/projection adapter. Eligibility calculations execute in the real service.
function matches(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === "object") {
      if ("not" in condition) return row[key] !== condition.not;
      return row[key] != null && matches(row[key], condition);
    }
    return row[key] === condition;
  });
}
function project(row, select) {
  return Object.fromEntries(Object.entries(select).map(([key, value]) => [key,
    value === true ? row[key] : row[key] == null ? null : Array.isArray(row[key])
      ? row[key].map((item) => project(item, value.select)) : project(row[key], value.select),
  ]));
}
function setup({ food = listing(), customers = [], businesses = [] } = {}) {
  const calls = { customers: 0, businesses: 0 };
  const prisma = {
    foodListing: { findUnique: async ({ where, select }) => food && matches(food, where) ? project(food, select) : null },
    user: { findMany: async ({ where, select }) => { calls.customers++; return customers.filter((r) => matches(r, where)).map((r) => project(r, select)); } },
    business: { findMany: async ({ where, select }) => { calls.businesses++; return businesses.filter((r) => matches(r, where)).map((r) => project(r, select)); } },
  };
  const loadedModule = { exports: {} };
  class FixedDate extends Date { constructor() { super(NOW.getTime()); } }
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, Date: FixedDate,
    require: (id) => { assert.equal(id, "@/lib/prisma"); return { prisma }; },
  });
  return { ...loadedModule.exports, calls };
}
const longitudeAtKm = (km) => km / 6371 * 180 / Math.PI;
const ids = (rows) => Array.from(rows, (r) => r.userId).sort();

test("loads an eligible future pickup listing and converts its price", async () => {
  const result = await setup().loadListingForMatching("food");
  assert.equal(result.id, "food");
  assert.equal(result.price, 50);
});

test("missing listing is not eligible", async () => {
  assert.equal(await setup({ food: null }).loadListingForMatching("food"), null);
});

const invalidListings = [
  ...["SOLD_OUT", "EXPIRED", "CANCELLED", "COMPLETED"].map((status) => [status, (r) => { r.status = status; }]),
  ["zero stock", (r) => { r.quantityAvailable = 0; }],
  ["past deadline", (r) => { r.pickupEnd = new Date(NOW.getTime() - 1); }],
  ["exact deadline", (r) => { r.pickupEnd = NOW; }],
  ...["PENDING", "REJECTED", "SUSPENDED"].map((status) => [`seller ${status}`, (r) => { r.business.status = status; }]),
  ...["BLOCKED", "INACTIVE"].map((status) => [`seller owner ${status}`, (r) => { r.business.owner.status = status; }]),
  ["seller owner wrong role", (r) => { r.business.owner.role = "CUSTOMER"; }],
  ["inactive category", (r) => { r.category.isActive = false; }],
  ["invalid shop location", (r) => { r.business.latitude = NaN; }],
];
for (const [name, mutate] of invalidListings) {
  test(`rejects listing with ${name}`, async () => {
    const food = listing(); mutate(food);
    assert.equal(await setup({ food }).loadListingForMatching("food"), null);
  });
}

test("Haversine keeps precision and remains finite at antipodal points", () => {
  const h = setup();
  assert.equal(h.calculateDistanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(h.calculateDistanceKm(0, 0, 0, 1) - 111.1949266) < 0.000001);
  assert.ok(Math.abs(h.calculateDistanceKm(0, 0, 0, 180) - Math.PI * 6371) < 0.000001);
});

test("invalid coordinates never produce a nearby distance", () => {
  const h = setup();
  for (const [lat, lng] of [[NaN, 0], [Infinity, 0], [91, 0], [-91, 0], [0, 181], [0, -181]]) {
    assert.equal(h.calculateDistanceKm(lat, lng, 0, 0), Infinity);
    assert.equal(h.calculateDistanceKm(0, 0, lat, lng), Infinity);
  }
});

test("customers without preferences or a complete valid location are excluded", async () => {
  const absent = customer("absent"); absent.preference = null;
  const rows = [absent, customer("null", { approxLatitude: null, approxLongitude: null }),
    customer("missing-lat", { approxLatitude: null }), customer("missing-lng", { approxLongitude: null }),
    customer("invalid", { approxLatitude: NaN }), customer("zero")];
  assert.deepEqual(ids(await setup({ customers: rows }).findNearbyCustomers(listing())), ["zero"]);
});

test("customer preferences, account status, role and seller exclusion are respected", async () => {
  const rows = [customer("match", { preferredCategories: [{ id: "bakery" }] }), customer("all"),
    customer("wrong-category", { preferredCategories: [{ id: "drinks" }] }), customer("disabled", { notificationsEnabled: false }),
    { ...customer("blocked"), status: "BLOCKED" }, { ...customer("inactive"), status: "INACTIVE" },
    { ...customer("business"), role: "BUSINESS" }, customer("seller-owner")];
  assert.deepEqual(ids(await setup({ customers: rows }).findNearbyCustomers(listing())), ["all", "match"]);
});

test("customer radius includes nearby points but excludes a point only 4 m beyond", async () => {
  const rows = [customer("inside", { approxLongitude: longitudeAtKm(2.999) }),
    customer("outside", { approxLongitude: longitudeAtKm(3.004) }), customer("far", { approxLongitude: 1 })];
  assert.deepEqual(ids(await setup({ customers: rows }).findNearbyCustomers(listing())), ["inside"]);
});

test("distance exactly equal to the configured radius is included", async () => {
  const h = setup();
  const distance = h.calculateDistanceKm(0, 0, 0, 0.01);
  const row = customer("boundary", { approxLongitude: 0.01, notifyRadiusKm: distance });
  assert.deepEqual(ids(await setup({ customers: [row] }).findNearbyCustomers(listing())), ["boundary"]);
});

test("invalid radii cannot make every customer nearby", async () => {
  const rows = [customer("nan", { notifyRadiusKm: NaN }), customer("infinite", { notifyRadiusKm: Infinity }), customer("zero", { notifyRadiusKm: 0 })];
  assert.equal((await setup({ customers: rows }).findNearbyCustomers(listing())).length, 0);
});

test("customer audience filtering accepts customer listings and skips business-only queries", async () => {
  const h = setup({ customers: [customer()] });
  assert.equal((await h.findNearbyCustomers({ ...listing(), audience: "CUSTOMERS_ONLY" })).length, 1);
  const calls = h.calls.customers;
  assert.equal((await h.findNearbyCustomers({ ...listing(), audience: "BUSINESSES_ONLY" })).length, 0);
  assert.equal(h.calls.customers, calls);
});

test("B2B accepts only approved businesses with active owners and enabled notifications", async () => {
  const blocked = business("blocked"); blocked.owner.status = "BLOCKED";
  const disabled = business("disabled"); disabled.owner.preference = { notificationsEnabled: false };
  const wrongRole = business("role"); wrongRole.owner.role = "CUSTOMER";
  const badLocation = business("invalid"); badLocation.longitude = NaN;
  const rows = [business(), { ...business("pending"), status: "PENDING" }, { ...business("suspended"), status: "SUSPENDED" },
    business("seller"), blocked, disabled, wrongRole, badLocation];
  assert.deepEqual(ids(await setup({ businesses: rows }).findNearbyBusinesses(listing())), ["buyer-owner"]);
});

test("B2B uses shop locations and fixed 5 km policy rather than customer preferences", async () => {
  const inside = business("inside"); inside.longitude = longitudeAtKm(4.999);
  inside.owner.preference = { notificationsEnabled: true, notifyRadiusKm: 1, preferredCategories: [{ id: "drinks" }], approxLatitude: 80, approxLongitude: 80 };
  const outside = business("outside"); outside.longitude = longitudeAtKm(5.004);
  assert.deepEqual(ids(await setup({ businesses: [inside, outside] }).findNearbyBusinesses(listing())), ["inside-owner"]);
});

for (const suitability of ["RESTRICTED", "UNSUITABLE"]) {
  test(`B2B excludes ${suitability} but customer matching still applies`, async () => {
    const food = listing(); food.category.b2bSuitability = suitability;
    const h = setup({ customers: [customer()], businesses: [business()] });
    assert.equal((await h.findNearbyBusinesses(food)).length, 0);
    assert.equal(h.calls.businesses, 0);
    assert.equal((await h.findNearbyCustomers(food)).length, 1);
  });
}

test("B2B audience and invalid radius guards skip matching", async () => {
  const h = setup({ businesses: [business()] });
  assert.equal((await h.findNearbyBusinesses({ ...listing(), audience: "CUSTOMERS_ONLY" })).length, 0);
  for (const radius of [NaN, Infinity, 0, -1]) assert.equal((await h.findNearbyBusinesses(listing(), radius)).length, 0);
  assert.equal(h.calls.businesses, 0);
  assert.equal((await h.findNearbyBusinesses({ ...listing(), audience: "BUSINESSES_ONLY" })).length, 1);
});
