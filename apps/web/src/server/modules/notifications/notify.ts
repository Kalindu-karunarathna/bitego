import type { NotificationTypeName } from "@bitego/shared";

// CONTRACT. Anyone may call notify(); Sachira owns the body.
// Today it does nothing. Sachira will replace it with: save a Notification row, then send a push to the user's devices.
// Do NOT change the signature without telling the team.
export type NotifyInput = {
  userId: string;
  type: NotificationTypeName;
  title: string;
  message: string;
  listingId?: string;
  reservationId?: string;
};

export async function notify(input: NotifyInput): Promise<void> {
  void input; // TODO(Sachira)
}
