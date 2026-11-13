import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, setupNotifier, USER, OTHER_USER, LISTING } from "../notifications/notification-test-harness.mjs";

function setup() {
  const h = setupNotifier(); const errors = [];
  function instance() {
    return loadTs("../matching/matching.ts", {
      "@/server/modules/notifications/notify": h.loadNotifier(),
      "@/server/modules/matching/matching.service": {
        loadListingForMatching: async id => ({ id, title: "Bread", price: 50, business: { name: "Bakery" } }),
        findNearbyCustomers: async () => [{ userId: USER, distanceKm: 1 }],
        findNearbyBusinesses: async () => [{ userId: OTHER_USER, distanceKm: 2 }, { userId: USER, distanceKm: 1 }],
      },
    }, { console: { warn: () => {}, error: (...args) => errors.push(args) } }).onListingCreated;
  }
  return { ...h, run: instance(), instance, errors };
}
test("replaying listing creation deduplicates across customers and B2B recipients", async () => {
  const h = setup(); await h.run(LISTING); await h.run(LISTING);
  assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2);
});
test("parallel listing hooks share the database uniqueness guard", async () => {
  const h = setup(); await Promise.all([h.run(LISTING), h.instance()(LISTING)]);
  assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2); assert.ok(h.calls.conflicts > 0);
});
test("retry after partial failure only dispatches to the previously failed recipient", async () => {
  const h = setup(); const create = h.prisma.notification.create; let failing = true;
  h.prisma.notification.create = async args => { if (failing && args.data.userId === OTHER_USER) throw new Error("Write failed"); return create(args); };
  await h.run(LISTING); assert.equal(h.stored.size, 1); assert.equal(h.errors.length, 1);
  failing = false; await h.run(LISTING);
  assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2);
  assert.deepEqual(h.calls.pushes.map(p => p.userId).sort(), [USER, OTHER_USER].sort());
});
