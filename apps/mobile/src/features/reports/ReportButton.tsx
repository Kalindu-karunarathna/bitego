import { Button } from "@/components/ui";

// CONTRACT. Owner: Kalindu. Nistha places <ReportButton listingId={id} /> on the listing detail screen.
// Today it does nothing. Kalindu will make it open a small form and send the report to the admin.
export function ReportButton({ listingId }: { listingId: string }) {
  void listingId; // TODO(Kalindu)
  return <Button title="Report this listing" variant="link" onPress={() => {}} />;
}
