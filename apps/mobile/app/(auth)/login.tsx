import { Link } from "expo-router";
import { useState } from "react";
import { Banner, Body, Button, ErrorText, Screen, TextField, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export default function Login() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError("Enter your email and password");
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password); // the root layout moves us to the right screen
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <Title>BiteGo</Title>
      <Body muted>Rescue surplus food near you.</Body>
      {notice ? <Banner tone="warning">{notice}</Banner> : null}
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
      <ErrorText>{error}</ErrorText>
      <Button title="Log in" onPress={submit} loading={busy} />
      <Link href="/register" asChild>
        <Button title="Create an account" variant="link" onPress={() => {}} />
      </Link>
    </Screen>
  );
}
