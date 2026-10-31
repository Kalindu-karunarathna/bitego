import { Banner, Body, Screen, Title } from "@/components/ui";

// Temporary content for screens that a team member will build. Replace the whole file's usage
// with the real screen when you implement it.
export function Placeholder({ title, owner, description }: { title: string; owner: string; description: string }) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Body muted>{description}</Body>
      <Banner>Coming soon. Module owner: {owner}.</Banner>
    </Screen>
  );
}
