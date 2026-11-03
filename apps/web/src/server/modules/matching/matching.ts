// CONTRACT. Kajanika calls onListingCreated(listing.id) right after a listing is created.
// Sachira owns the body: find customers (preferences + distance) and businesses (B2B-suitable categories) and notify() them.
// Today it does nothing. Do NOT change the signature without telling the team.
export async function onListingCreated(listingId: string): Promise<void> {
  void listingId; // TODO(Sachira)
}
