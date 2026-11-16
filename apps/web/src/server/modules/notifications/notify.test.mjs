import assert from "node:assert/strict";
import test from "node:test";
import { setupNotifier, event, identity, USER, OTHER_USER, OTHER_LISTING, RESERVATION, OTHER_RESERVATION } from "./notification-test-harness.mjs";

for (const input of [event(), event({ type: "LISTING_NEARING_EXPIRY" }), event({ type: "PICKUP_REMINDER", reservationId: RESERVATION })]) {
  test(input.type + " creates one row and dispatches once across repeated calls", async () => {
    const h = setupNotifier(); assert.equal(await h.notifyOnce(input), true);
    assert.equal(await h.notifyOnce(input), false); assert.equal(await h.notify(input), undefined);
    assert.equal(h.stored.size, 1); assert.equal(h.calls.pushes.length, 1);
  });
  test(input.type + " handles concurrent calls from separate notifier instances", async () => {
    const h = setupNotifier(); const second = h.loadNotifier();
    const results = await Promise.all([h.notifyOnce(input), second.notifyOnce(input)]);
    assert.deepEqual(results.sort(), [false, true]); assert.equal(h.calls.conflicts, 1);
    assert.equal(h.stored.size, 1); assert.equal(h.calls.pushes.length, 1);
  });
}
test("recognizes an older random-ID notification even after it is marked read", async () => {
  const h = setupNotifier({ rows: [{ ...event(), id: "00000000-0000-4000-8000-000000000001", isRead: true }] });
  assert.equal(await h.notifyOnce(event()), false); assert.equal(h.calls.creates, 0); assert.equal(h.calls.pushes.length, 0);
});
test("a new notifier instance still deduplicates using persisted data", async () => {
  const h = setupNotifier(); await h.notify(event());
  assert.equal(await h.loadNotifier().notifyOnce(event({ message: "Changed price" })), false);
  assert.equal(h.calls.pushes.length, 1);
});
test("opt-out skips storage and push without consuming the once-only identity", async () => {
  const h = setupNotifier({ disabledUsers: [USER] });
  assert.equal(await h.notifyOnce(event()), false); assert.equal(h.stored.size, 0); assert.equal(h.calls.pushes.length, 0);
  h.disabled.delete(USER); assert.equal(await h.notifyOnce(event()), true);
});
test("different recipients, listings, and reservations remain separate", async () => {
  const h = setupNotifier();
  for (const input of [event(), event({ userId: OTHER_USER }), event({ listingId: OTHER_LISTING }),
    event({ type: "PICKUP_REMINDER", reservationId: RESERVATION }),
    event({ type: "PICKUP_REMINDER", reservationId: OTHER_RESERVATION })]) assert.equal(await h.notifyOnce(input), true);
  assert.equal(h.stored.size, 5); assert.equal(h.calls.pushes.length, 5);
});
test("ordinary lifecycle events retain their existing repeatable behavior", async () => {
  const h = setupNotifier(); const input = event({ type: "BUSINESS_APPROVED" });
  await h.notify(input); await h.notify(input); assert.equal(h.stored.size, 2); assert.equal(h.calls.pushes.length, 2);
});
test("notifyOnce rejects unsupported event types instead of silently skipping deduplication", async () => {
  const h = setupNotifier(); await assert.rejects(h.notifyOnce(event({ type: "BUSINESS_APPROVED" })), /does not support/);
  assert.equal(h.stored.size, 0);
});
test("missing identity fails before any push or insert", async () => {
  const h = setupNotifier(); await assert.rejects(h.notify(event({ listingId: undefined })), /requires listingId/);
  assert.equal(h.calls.creates, 0); assert.equal(h.calls.pushes.length, 0);
});
for (const [label, config] of [
  ["database outage", { createError: new Error("DB unavailable") }],
  ["foreign key error", { createError: Object.assign(new Error("FK error"), { code: "P2003" }) }],
  ["unrelated unique violation", { createError: Object.assign(new Error("Other unique"), { code: "P2002" }) }],
  ["dedupe lookup failure", { readError: new Error("Read failed") }],
]) test(label + " is not mistaken for a duplicate", async () => {
  const h = setupNotifier(config); await assert.rejects(h.notifyOnce(event())); assert.equal(h.calls.pushes.length, 0);
});
test("a conflicting ID for a different event fails closed rather than suppressing a real notification", async () => {
  const expected = identity.notificationIdentity(event()).id;
  const h = setupNotifier({ rows: [{ ...event({ userId: OTHER_USER }), id: expected }] });
  await assert.rejects(h.notifyOnce(event()), error => error.code === "P2002"); assert.equal(h.calls.pushes.length, 0);
});
test("after an insert failure a later run can still create the notification", async () => {
  const h = setupNotifier(); const create = h.prisma.notification.create;
  h.prisma.notification.create = async () => { throw new Error("Temporary failure"); };
  await assert.rejects(h.notifyOnce(event())); h.prisma.notification.create = create;
  assert.equal(await h.notifyOnce(event()), true); assert.equal(h.calls.pushes.length, 1);
});
test("push failure preserves the saved notification and does not trigger replay on another run", async () => {
  const h = setupNotifier({ pushError: new Error("Expo unavailable") });
  assert.equal(await h.notifyOnce(event()), true); await Promise.resolve();
  assert.equal(await h.notifyOnce(event()), false); assert.equal(h.stored.size, 1);
  assert.equal(h.calls.pushes.length, 1); assert.equal(h.calls.errors.length, 1);
});
test("the winning push contains the actual saved notification ID", async () => {
  const h = setupNotifier(); await h.notify(event());
  const push = h.calls.pushes[0]; assert.equal(push.data.notificationId, [...h.stored.keys()][0]);
  assert.equal(push.data.listingId, event().listingId); assert.equal(push.data.type, "NEW_NEARBY_LISTING");
});
