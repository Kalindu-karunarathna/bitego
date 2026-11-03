import { Text } from "react-native";
import { useAuth } from "@/features/auth/AuthProvider";
import { Body, Button, Card, Heading, Screen, Spacer, Title } from "@/components/ui";

const ROLE_LABEL = { CUSTOMER: "Customer", BUSINESS: "Business", ADMIN: "Admin" } as const;

// Account tab used by customers and businesses. Edit profile, notification settings etc. will be added here.
export function ProfileView() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  return (
    <Screen>
      <Title>Account</Title>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{profile.fullName}</Text>
        <Body muted>{profile.email}</Body>
        {profile.phone ? <Body muted>{profile.phone}</Body> : null}
        <Body>{ROLE_LABEL[profile.role]}</Body>
      </Card>
      {profile.business ? (
        <>
          <Heading>Your business</Heading>
          <Card>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{profile.business.name}</Text>
            <Body muted>Status: {profile.business.status}</Body>
          </Card>
        </>
      ) : null}
      <Spacer />
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
