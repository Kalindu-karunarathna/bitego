import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("./matching.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ eligible = true, customers = [], businesses = [], loadError, notifyErrorFor } = {}) {
  const calls = { customers: 0, businesses: 0, notifications: [], errors: [] };
  const dependencies = {
    "@/server/modules/matching/matching.service": {
      async loadListingForMatching(id) {
        if (loadError) throw loadError;
        return eligible ? { id, title: "Bread", price: 50, business: { name: "Bakery" } } : null;
      },
      async findNearbyCustomers() { calls.customers++; return customers; },
      async findNearbyBusinesses() { calls.businesses++; return businesses; },
    },
    "@/server/modules/notifications/notify": {
      async notify(payload) {
        calls.notifications.push(payload);
        if (payload.userId === notifyErrorFor) throw new Error("Notification unavailable");
      },
    },
  };
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    console: { warn: () => {}, error: (...args) => calls.errors.push(args) },
    require: (id) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`); return dependencies[id]; },
  });
  return { run: loadedModule.exports.onListingCreated, calls };
}

test("missing or ineligible listings never trigger recipient queries or notifications", async () => {
  const h = setup({ eligible: false });
  await h.run("food");
  assert.equal(h.calls.customers, 0);
  assert.equal(h.calls.businesses, 0);
  assert.equal(h.calls.notifications.length, 0);
});

test("eligible listing with no matches does not notify anyone", async () => {
  const h = setup();
  await h.run("food");
  assert.equal(h.calls.customers, 1);
  assert.equal(h.calls.businesses, 1);
  assert.equal(h.calls.notifications.length, 0);
});

test("passes the listing ID and correct content, deduplicating recipients within one call", async () => {
  const h = setup({ customers: [{ userId: "customer", distanceKm: 1 }], businesses: [{ userId: "business", distanceKm: 2 }, { userId: "customer", distanceKm: 1 }] });
  await h.run("food");
  assert.deepEqual(h.calls.notifications.map((n) => n.userId).sort(), ["business", "customer"]);
  for (const notification of h.calls.notifications) {
    assert.equal(notification.listingId, "food");
    assert.equal(notification.type, "NEW_NEARBY_LISTING");
    assert.equal(notification.message, 'Bakery listed "Bread" for LKR 50.00.');
  }
});

test("listing load failure is logged without notifying recipients or rejecting the caller", async () => {
  const h = setup({ loadError: new Error("Database unavailable") });
  await assert.doesNotReject(h.run("food"));
  assert.equal(h.calls.customers, 0);
  assert.equal(h.calls.notifications.length, 0);
  assert.equal(h.calls.errors.length, 1);
});

test("one failed notification does not prevent other eligible recipients being attempted", async () => {
  const h = setup({ customers: [{ userId: "one", distanceKm: 1 }, { userId: "two", distanceKm: 2 }], notifyErrorFor: "one" });
  await assert.doesNotReject(h.run("food"));
  assert.deepEqual(h.calls.notifications.map((n) => n.userId).sort(), ["one", "two"]);
  assert.equal(h.calls.errors.length, 1);
});
