import { Body, Button, Screen, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

// Admins work in the web dashboard, not in the phone app.
export default function AdminNotice() {
  const { signOut } = useAuth();
  return (
    <Screen centered>
      <Title>Admin account</Title>
      <Body muted>Admins manage BiteGo from the web dashboard. Please use it instead of the phone app.</Body>
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
