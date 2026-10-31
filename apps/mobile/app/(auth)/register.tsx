import { useRouter } from "expo-router";
import { Body, Button, Card, Screen, Title } from "@/components/ui";

export default function ChooseAccountType() {
  const router = useRouter();
  return (
    <Screen centered>
      <Title>Create an account</Title>
      <Body muted>How will you use BiteGo?</Body>
      <Card onPress={() => router.push("/register-customer")}>
        <Body>I want to buy surplus food</Body>
        <Body muted>Customer account</Body>
      </Card>
      <Card onPress={() => router.push("/register-business")}>
        <Body>I want to sell surplus food</Body>
        <Body muted>Business account (restaurant, bakery, shop…). Needs admin approval.</Body>
      </Card>
      <Button title="Back to log in" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
