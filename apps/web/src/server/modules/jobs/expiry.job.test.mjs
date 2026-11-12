import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Run the actual job with in-memory dependencies: no database, environment secrets,
// or push requests. These tests model atomic writes, not PostgreSQL lock behavior.
const source = readFileSync(new URL("./expiry.job.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const NOW = new Date("2026-11-12T10:00:00.000Z");
const PAST = new Date(NOW.getTime() - 1);
const FUTURE = new Date(NOW.getTime() + 1);

function reservation(id, status = "CONFIRMED", pickupEnd = PAST) {
  return { id, status, buyerId: `buyer-${id}`, listingId: `listing-${id}`, pickupEnd };
}

function setup({ reservations = [], listings = [], beforeWrite, failNotificationFor, writeError } = {}) {
  const notifications = [];
  const errors = [];
  const cutoffs = [];
  const prisma = {
    foodListing: {
      async updateMany({ where, data }) {
        cutoffs.push(where.pickupEnd.lte.toISOString());
        let count = 0;
        for (const listing of listings) {
          if (where.status.in.includes(listing.status) && listing.pickupEnd <= where.pickupEnd.lte) {
            Object.assign(listing, data);
            count++;
          }
        }
        return { count };
      },
    },
    reservation: {
      async updateManyAndReturn({ where, data, select }) {
        if (writeError) throw writeError;
        beforeWrite?.();
        cutoffs.push(where.listing.pickupEnd.lte.toISOString());
        // Apply each write without yielding, modeling a conditional atomic update.
        const changed = [];
        for (const row of reservations) {
          if ((where.status === undefined || row.status === where.status) && row.pickupEnd <= where.listing.pickupEnd.lte) {
            Object.assign(row, data);
            changed.push(Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])));
          }
        }
        return changed;
      },
    },
  };
  const dependencies = {
    "@/lib/prisma": { prisma },
    "@/server/modules/notifications/notify": {
      async notify(payload) {
        notifications.push(payload);
        if (payload.reservationId === failNotificationFor) throw new Error("Notification unavailable");
      },
    },
  };
  const loadedModule = { exports: {} };
  class FixedDate extends Date {
    constructor() { super(NOW.getTime()); }
  }
  vm.runInNewContext(compiled, {
    module: loadedModule,
    exports: loadedModule.exports,
    Date: FixedDate,
    console: { error: (...args) => errors.push(args) },
    require: (id) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  }, { filename: "expiry.job.ts" });
  return { run: loadedModule.exports.runExpiryJob, notifications, errors, cutoffs };
}

test("expires only due confirmed reservations, including the exact deadline", async () => {
  const rows = [reservation("past"), reservation("boundary", "CONFIRMED", NOW), reservation("future", "CONFIRMED", FUTURE), reservation("picked", "PICKED_UP"), reservation("cancelled", "CANCELLED"), reservation("expired", "EXPIRED")];
  const h = setup({ reservations: rows });
  const result = await h.run();
  assert.equal(result.expiredReservationsCount, 2);
  assert.deepEqual(rows.map((row) => row.status), ["EXPIRED", "EXPIRED", "CONFIRMED", "PICKED_UP", "CANCELLED", "EXPIRED"]);
  assert.deepEqual(h.notifications.map((n) => n.reservationId).sort(), ["boundary", "past"]);
  assert.equal(h.notifications[0].userId, "buyer-past");
  assert.equal(h.notifications[0].listingId, "listing-past");
  assert.equal(h.notifications[0].type, "RESERVATION_CANCELLED");
});

for (const status of ["PICKED_UP", "CANCELLED"]) {
  test(`preserves a ${status} transition completed before the expiry write`, async () => {
    const row = reservation("race");
    const h = setup({ reservations: [row], beforeWrite: () => { row.status = status; } });
    const result = await h.run();
    assert.equal(row.status, status);
    assert.equal(result.expiredReservationsCount, 0);
    assert.equal(h.notifications.length, 0);
  });
}

test("rechecks the pickup deadline at the reservation write", async () => {
  const row = reservation("extended");
  const h = setup({ reservations: [row], beforeWrite: () => { row.pickupEnd = FUTURE; } });
  assert.equal((await h.run()).expiredReservationsCount, 0);
  assert.equal(row.status, "CONFIRMED");
  assert.equal(h.notifications.length, 0);
});

test("repeated runs do not count or notify already expired reservations", async () => {
  const h = setup({ reservations: [reservation("one")] });
  assert.equal((await h.run()).expiredReservationsCount, 1);
  assert.equal((await h.run()).expiredReservationsCount, 0);
  assert.equal(h.notifications.length, 1);
});

test("overlapping runs notify each reservation only once with atomic writes", async () => {
  const h = setup({ reservations: [reservation("one"), reservation("two")] });
  const results = await Promise.all([h.run(), h.run()]);
  assert.equal(results.reduce((sum, r) => sum + r.expiredReservationsCount, 0), 2);
  assert.deepEqual(h.notifications.map((n) => n.reservationId).sort(), ["one", "two"]);
});

test("expires due active and sold-out listings while preserving other states", async () => {
  const listings = [
    { status: "ACTIVE", pickupEnd: PAST }, { status: "SOLD_OUT", pickupEnd: NOW },
    { status: "ACTIVE", pickupEnd: FUTURE }, { status: "COMPLETED", pickupEnd: PAST },
    { status: "CANCELLED", pickupEnd: PAST },
  ];
  const h = setup({ listings });
  assert.equal((await h.run()).expiredListingsCount, 2);
  assert.deepEqual(listings.map((row) => row.status), ["EXPIRED", "EXPIRED", "ACTIVE", "COMPLETED", "CANCELLED"]);
});

test("empty runs return zero counts and use one cutoff time", async () => {
  const h = setup();
  const result = await h.run();
  assert.equal(result.expiredListingsCount, 0);
  assert.equal(result.expiredReservationsCount, 0);
  assert.equal(result.timestamp, NOW.toISOString());
  assert.deepEqual(h.cutoffs, [result.timestamp, result.timestamp]);
  assert.equal(h.notifications.length, 0);
});

test("notification failure does not undo expiry or prevent other notifications", async () => {
  const rows = [reservation("one"), reservation("two")];
  const h = setup({ reservations: rows, failNotificationFor: "one" });
  assert.equal((await h.run()).expiredReservationsCount, 2);
  assert.ok(rows.every((row) => row.status === "EXPIRED"));
  assert.equal(h.notifications.length, 2);
  assert.equal(h.errors.length, 1);
});

test("failed reservation writes reject without sending expiry notifications", async () => {
  const h = setup({ reservations: [reservation("one")], writeError: new Error("Database unavailable") });
  await assert.rejects(h.run(), /Database unavailable/);
  assert.equal(h.notifications.length, 0);
});
