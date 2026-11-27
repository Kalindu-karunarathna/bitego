import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, setupNotifier, USER, OTHER_USER, LISTING, OTHER_LISTING, RESERVATION, OTHER_RESERVATION } from "../notifications/notification-test-harness.mjs";

const NOW = new Date("2026-11-13T06:00:00Z");
const atMinute = minute => new Date(NOW.getTime() + minute * 60000);
const listing = (overrides = {}) => ({ id: LISTING, status: "ACTIVE", title: "Bread", pickupEnd: atMinute(45),
  business: { ownerId: USER, name: "Bakery" }, ...overrides });
const reservation = (overrides = {}) => ({ id: RESERVATION, status: "CONFIRMED", buyerId: OTHER_USER,
  pickupCode: "BG1234", listingId: LISTING,
  listing: { title: "Bread", pickupEnd: atMinute(20), business: { name: "Bakery" } }, ...overrides });
function setup({ listings = [listing()], reservations = [reservation()], notifierOptions = {} } = {}) {
  const h = setupNotifier(notifierOptions); const errors = [];
  const prisma = { ...h.prisma,
    foodListing: { findMany: async ({ where }) => listings.filter(row => row.status === where.status && row.pickupEnd > where.pickupEnd.gt && row.pickupEnd <= where.pickupEnd.lte) },
    reservation: { findMany: async ({ where }) => reservations.filter(row => row.status === where.status && row.listing.pickupEnd > where.listing.pickupEnd.gt && row.listing.pickupEnd <= where.listing.pickupEnd.lte) },
  };
  class FixedDate extends Date { constructor(value = NOW.getTime()) { super(value); } }
  const { runReminderJob } = loadTs("../jobs/reminder.job.ts", {
    "@/lib/prisma": { prisma }, "@/server/modules/notifications/notify": h,
  }, { Date: FixedDate, console: { error: (...args) => errors.push(args) } });
  return { ...h, run: runReminderJob, errors };
}
test("repeated reminder runs save and count each event only once", async () => {
  const h = setup(); const first = await h.run(); const second = await h.run();
  assert.equal(first.nearingExpiryListingsNotified, 1); assert.equal(first.pickupRemindersNotified, 1);
  assert.equal(second.nearingExpiryListingsNotified, 0); assert.equal(second.pickupRemindersNotified, 0);
  assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2);
});
test("overlapping reminder runs count only the winning inserts", async () => {
  const h = setup(); const results = await Promise.all([h.run(), h.run()]);
  assert.equal(results.reduce((n,r) => n + r.nearingExpiryListingsNotified, 0), 1);
  assert.equal(results.reduce((n,r) => n + r.pickupRemindersNotified, 0), 1);
  assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2); assert.ok(h.calls.conflicts > 0);
});
test("opted-out recipients are not included in either reminder count", async () => {
  const h = setup({ notifierOptions: { disabledUsers: [USER, OTHER_USER] } }); const result = await h.run();
  assert.equal(result.nearingExpiryListingsNotified, 0); assert.equal(result.pickupRemindersNotified, 0);
  assert.equal(h.stored.size, 0); assert.equal(h.calls.pushes.length, 0);
});
test("an old read reminder is not recreated or counted", async () => {
  const h = setup({ listings: [], notifierOptions: { rows: [{ id: "old-random-id", userId: OTHER_USER,
    type: "PICKUP_REMINDER", reservationId: RESERVATION, isRead: true }] } });
  assert.equal((await h.run()).pickupRemindersNotified, 0); assert.equal(h.calls.pushes.length, 0);
});
test("failure for one recipient does not stop another recipient or inflate counts", async () => {
  const h = setup(); const create = h.prisma.notification.create;
  h.prisma.notification.create = async args => { if (args.data.userId === USER) throw new Error("Write failed"); return create(args); };
  const result = await h.run();
  assert.equal(result.nearingExpiryListingsNotified, 0); assert.equal(result.pickupRemindersNotified, 1);
  assert.equal(h.errors.length, 1); assert.equal(h.calls.pushes.length, 1);
});
test("reminder windows keep the lower deadline exclusive and upper deadline inclusive", async () => {
  const h = setup({ listings: [listing({ pickupEnd: NOW }), listing({ pickupEnd: atMinute(61) }),
    listing({ status: "EXPIRED" }), listing({ id: OTHER_LISTING, pickupEnd: atMinute(60) })],
    reservations: [reservation({ listing: { pickupEnd: NOW } }), reservation({ listing: { pickupEnd: atMinute(31) } }),
      reservation({ status: "PICKED_UP" }), reservation({ id: OTHER_RESERVATION, listing: { ...reservation().listing, pickupEnd: atMinute(30) } })] });
  const result = await h.run(); assert.equal(result.nearingExpiryListingsNotified, 1); assert.equal(result.pickupRemindersNotified, 1);
});
test("two separate reservations for one buyer/listing each receive a pickup reminder", async () => {
  const h = setup({ listings: [], reservations: [reservation(), reservation({ id: OTHER_RESERVATION })] });
  assert.equal((await h.run()).pickupRemindersNotified, 2); assert.equal(h.calls.pushes.length, 2);
});
