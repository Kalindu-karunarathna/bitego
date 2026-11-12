import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { color } from "@/features/listings/design";
import { AppHeader, FormBlock, Page } from "@/features/listings/kit";

// Help, terms and about pages from the design's Account screen, written for how BiteGo works today.
const PAGES: Record<string, { title: string; blocks: [string, string][] }> = {
  help: {
    title: "Help Center & FAQs",
    blocks: [
      ["How do I verify a pickup?", "Open Reservations and tap Verify pickup, then enter the customer's 6-digit pickup code. Confirm only after you hand over the food."],
      ["How do I edit a listing?", "Open a listing and tap Edit listing. The quantity cannot go below what is already reserved, and once someone has reserved, the pickup time can only be extended."],
      ["What happens when a listing ends?", "When the pickup time ends, the listing moves to Expired automatically and no one can reserve it."],
      ["What is a no-show?", "A reservation that was not collected before the pickup deadline. It is marked automatically."],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    blocks: [
      ["Food safety", "Providers must only list safe, suitable surplus food and describe it accurately."],
      ["Reservations", "Confirmed reservations must be honoured. Pickup is by customers only; BiteGo does not provide delivery."],
      ["Privacy", "We use business and reservation details only to run the marketplace and never sell personal data."],
    ],
  },
  about: {
    title: "About BiteGo",
    blocks: [
      ["Good food. Less waste. Nearby pickup.", "BiteGo connects food providers with nearby customers and businesses who reserve surplus food and collect it before a pickup deadline."],
      ["Version", "BiteGo for Business v1.0.0"],
      ["Project", "SE5104 Mini Project, Faculty of Computing, Sabaragamuwa University of Sri Lanka."],
    ],
  },
};

export function InfoScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const content = PAGES[page ?? ""] ?? PAGES.help;
  return (
    <Page header={<AppHeader title={content.title} />}>
      <FormBlock>
        {content.blocks.map(([q, a], i) => (
          <View key={q} style={[styles.block, i > 0 && styles.blockBorder]}>
            <Text style={styles.q}>{q}</Text>
            <Text style={styles.a}>{a}</Text>
          </View>
        ))}
      </FormBlock>
    </Page>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 12 },
  blockBorder: { borderTopWidth: 1, borderTopColor: color.softLine },
  q: { fontSize: 15, fontWeight: "700", color: color.text },
  a: { fontSize: 13, lineHeight: 20, color: color.muted, marginTop: 5 },
});
