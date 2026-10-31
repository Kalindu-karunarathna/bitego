import { useState } from "react";
import { Banner, Body, Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

// Shown to a business until an admin approves it. "Check again" re-reads the status from the server.
export default function PendingApproval() {
  const { profile, reload, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const business = profile?.business;
  const status = business?.status;
  const rejected = status === "REJECTED" || status === "SUSPENDED";

  async function check() {
    setChecking(true);
    await reload();
    setChecking(false);
  }

  return (
    <Screen centered>
      <Title>{rejected ? "Business not approved" : "Waiting for approval"}</Title>
      {business ? (
        <Card>
          <Body>{business.name}</Body>
          <Body muted>Status: {status}</Body>
        </Card>
      ) : null}
      {rejected ? (
        <Banner tone="error">
          {business?.verification?.remarks ?? "Your business could not be approved. Please contact support."}
        </Banner>
      ) : (
        <Banner tone="warning">
          An admin is reviewing your business. You can post surplus food as soon as it is approved.
        </Banner>
      )}
      {!rejected ? <Button title="Check again" onPress={check} loading={checking} /> : null}
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
