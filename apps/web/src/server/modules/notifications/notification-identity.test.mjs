import assert from "node:assert/strict";
import test from "node:test";
import { identity, event, OTHER_USER, OTHER_LISTING, RESERVATION, OTHER_RESERVATION } from "./notification-test-harness.mjs";

const id = input => identity.notificationIdentity(input)?.id;
test("stable UUID v5 is independent of message text, read state, and repeated calls", () => {
  const original = id(event());
  // Freeze the name encoding/namespace so a refactor cannot resend past events.
  assert.equal(original, "d097c0dc-781b-5c9c-89b7-875532e92712");
  assert.match(original, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id(event({ title: "Changed title", message: "New price", isRead: true })), original);
  assert.equal(id(event()), original);
});
test("UUID spelling cannot bypass the duplicate key", () => {
  assert.equal(id(event({ listingId: event().listingId.toUpperCase() })), id(event()));
  assert.throws(() => id(event({ listingId: event().listingId.replaceAll("-", "") })), /UUID/);
});
test("recipient, notification type, and listing each have separate identities", () => {
  assert.equal(new Set([id(event()), id(event({ userId: OTHER_USER })), id(event({ listingId: OTHER_LISTING })),
    id(event({ type: "LISTING_NEARING_EXPIRY" }))]).size, 4);
});
test("pickup reminders are once per reservation, not per listing", () => {
  const first = event({ type: "PICKUP_REMINDER", reservationId: RESERVATION });
  assert.notEqual(id(first), id({ ...first, reservationId: OTHER_RESERVATION }));
  assert.equal(id(first), id({ ...first, listingId: OTHER_LISTING }));
});
for (const type of ["NEW_NEARBY_LISTING", "LISTING_NEARING_EXPIRY", "PICKUP_REMINDER"]) {
  test(type + " rejects missing event identity", () => {
    assert.throws(() => id(event({ type, listingId: undefined, reservationId: undefined })), /requires/);
  });
}
for (const type of ["RESERVATION_CONFIRMED", "RESERVATION_CANCELLED", "BUSINESS_APPROVED", "BUSINESS_REJECTED"]) {
  test(type + " stays outside once-only matching/reminder policy", () => assert.equal(id(event({ type })), undefined));
}
