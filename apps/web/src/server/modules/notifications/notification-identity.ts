import { createHash } from "node:crypto";
import type { NotificationTypeName } from "@bitego/shared";

type EventInput = {
  userId: string;
  type: NotificationTypeName;
  listingId?: string;
  reservationId?: string;
};

export type NotificationIdentity = {
  id: string;
  where: { userId: string; type: NotificationTypeName; listingId?: string; reservationId?: string };
};

// Permanent UUID v5 namespace for BiteGo notification events. Never change this or the
// name encoding on deployment: every server must derive the same ID for the same event.
const EVENT_NAMESPACE = Buffer.from("a7346c0882104f4c9e9ff8b2bd923501", "hex");

function canonicalUuid(value: string): string {
  // Accept the canonical UUID spelling used by our contracts, including upper case.
  // Reject alternate spellings rather than giving the same database UUID two hashes.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Notification event identifiers must be UUIDs");
  }
  return value.toLowerCase();
}

/** Only these three event types are once per recipient/entity; lifecycle events repeat. */
export function notificationIdentity(input: EventInput): NotificationIdentity | null {
  let entity: "listingId" | "reservationId";
  switch (input.type) {
    case "NEW_NEARBY_LISTING":
    case "LISTING_NEARING_EXPIRY": entity = "listingId"; break;
    case "PICKUP_REMINDER": entity = "reservationId"; break;
    default: return null;
  }
  const entityId = input[entity];
  if (!entityId?.trim()) throw new Error(input.type + " requires " + entity);
  // PostgreSQL UUID comparison ignores case; the hash must do the same.
  const userId = canonicalUuid(input.userId);
  const normalizedId = canonicalUuid(entityId);
  const name = JSON.stringify([userId, input.type, entity, normalizedId]);
  const bytes = createHash("sha1").update(EVENT_NAMESPACE).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // UUID v5 (name based), not a security token.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  return { id, where: { userId, type: input.type, [entity]: normalizedId } };
}
