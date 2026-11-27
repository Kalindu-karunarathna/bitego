import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportTypeName } from "@bitego/shared";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { apiFetch, ApiRequestError } from "@/api/client";
import { Banner, Body, Button, ChoiceChips, Heading, TextField } from "@/components/ui";

// CONTRACT. Owner: Kalindu. Place <ReportButton listingId={id} /> on a listing screen.
// Opens a small form (what is wrong + optional note) and sends the report to the admin.
export function ReportButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportTypeName | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
    if (sent) {
      setSent(false);
      setType(null);
      setDescription("");
    }
  }

  async function submit() {
    if (!type) {
      setError("Please choose what is wrong.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/reports", {
        body: { listingId, type, ...(description.trim() ? { description: description.trim() } : {}) },
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Could not send the report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button title="Report this listing" variant="link" onPress={() => setOpen(true)} />
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {sent ? (
                <>
                  <Heading>Thank you</Heading>
                  <Body>We received your report. Our team will review this listing.</Body>
                  <View style={styles.gap} />
                  <Button title="Close" onPress={close} />
                </>
              ) : (
                <>
                  <Heading>Report this listing</Heading>
                  <Body muted>Tell us what is wrong. An admin will review it.</Body>
                  <View style={styles.gap} />
                  <ChoiceChips
                    label="What is the problem?"
                    options={REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }))}
                    value={type}
                    onChange={setType}
                  />
                  <TextField
                    label="More details"
                    optional
                    multiline
                    value={description}
                    onChangeText={(v) => setDescription(v.slice(0, 500))}
                    placeholder="Describe what you saw"
                  />
                  {error ? <Banner tone="error">{error}</Banner> : null}
                  <View style={styles.gap} />
                  <Button title="Send report" onPress={submit} loading={loading} />
                  <Button title="Cancel" variant="secondary" onPress={close} disabled={loading} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "85%", backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  gap: { height: 12 },
});
