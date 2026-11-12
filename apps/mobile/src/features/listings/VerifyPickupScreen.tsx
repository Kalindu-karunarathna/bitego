import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { pickupCodeSchema, type SellerOrderDto } from "@bitego/shared";
import { confirmPickup, verifyPickupCode } from "@/api/seller";
import { color, formatDay, formatPrice, formatQuantity, formatTime, formatWindow, reservationRef } from "./design";
import { Icon } from "./Icon";
import { AppHeader, Btn, errorMessage, FormError, Page, SuccessIcon } from "./kit";

// Design: "Verify customer pickup". Enter the code, check the order, confirm the handover, then a pickup ticket.
// The "Scan QR code" tab is shown as coming soon until buyers have a QR code.
export function VerifyPickupScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<"scan" | "code">("code");
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<SellerOrderDto | null>(null);
  const [done, setDone] = useState<SellerOrderDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setOrder(null);
    setDone(null);
    setError(null);
  }

  async function check() {
    setError(null);
    const parsed = pickupCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the pickup code");
      return;
    }
    setBusy(true);
    try {
      setOrder(await verifyPickupCode(parsed.data.code));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      setDone(await confirmPickup(code.trim().toUpperCase()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const at = done.pickedUpAt ? new Date(done.pickedUpAt) : new Date();
    return (
      <Page
        header={<AppHeader title="Pickup confirmed" />}
        footer={
          <>
            <Btn title="View activity" icon="chart" onPress={() => router.replace("/sell/activity")} />
            <Btn title="Check another code" variant="ghost" onPress={reset} />
          </>
        }
      >
        <View style={styles.hero}>
          <SuccessIcon size={72} />
          <Text style={styles.heroTitle}>Pickup confirmed</Text>
          <Text style={styles.heroText}>Reserved → Picked up → Completed</Text>
        </View>
        <View style={styles.ticket}>
          <View style={styles.ticketId}>
            <Text style={styles.small}>Reservation ID</Text>
            <Text style={styles.ticketRef}>{reservationRef(done.id)}</Text>
          </View>
          <Row label="Customer" value={done.buyer.fullName} />
          <Row label="Food" value={done.listing.title} />
          <Row label="Quantity" value={formatQuantity(done.quantity, done.listing.unit)} />
          <Row label={done.totalPrice === 0 ? "Price" : "Collected"} value={formatPrice(done.totalPrice)} />
          <Row label="Completed" value={`${formatDay(at)}, ${formatTime(at)}`} />
          <View style={styles.stamp}>
            <Icon name="check" size={17} color={color.primary} />
            <Text style={styles.stampText}>Pickup completed</Text>
          </View>
        </View>
      </Page>
    );
  }

  if (order) {
    return (
      <Page
        header={<AppHeader title="Check the order" onBack={reset} />}
        footer={
          <>
            <FormError>{error}</FormError>
            <Btn title="Confirm pickup" icon="check" loading={busy} onPress={() => void confirm()} />
            <Btn title="Use a different code" variant="ghost" disabled={busy} onPress={reset} />
          </>
        }
      >
        <View style={styles.valid}>
          <Icon name="shield" color={color.primary} />
          <Text style={styles.validText}>Code {code.trim().toUpperCase()} is valid</Text>
        </View>
        <View style={styles.ticket}>
          <View style={styles.ticketId}>
            <Text style={styles.small}>Reservation ID</Text>
            <Text style={styles.ticketRef}>{reservationRef(order.id)}</Text>
          </View>
          <Row label="Customer" value={`${order.buyer.fullName}${order.buyer.isBusiness ? " (business)" : ""}`} />
          <Row label="Food" value={order.listing.title} />
          <Row label="Quantity" value={formatQuantity(order.quantity, order.listing.unit)} />
          <Row label="Pickup" value={formatWindow(order.listing.pickupStart, order.listing.pickupEnd)} />
          <View style={styles.collect}>
            <Text style={styles.collectLabel}>{order.totalPrice === 0 ? "Free food" : "Total to collect"}</Text>
            <Text style={styles.collectValue}>{formatPrice(order.totalPrice)}</Text>
          </View>
        </View>
        <Text style={styles.warn}>Confirm only after handing over the food. This cannot be undone.</Text>
      </Page>
    );
  }

  return (
    <Page
      header={<AppHeader title="Verify pickup" />}
      footer={
        <View style={styles.pickupOnly}>
          <Icon name="store" size={15} color={color.primary} />
          <Text style={styles.pickupOnlyText}>Pickup verification only — no delivery</Text>
        </View>
      }
    >
      <View style={styles.intro}>
        <Text style={styles.heroTitle}>Verify customer pickup</Text>
        <Text style={styles.heroText}>Scan the customer's QR code or enter their pickup code.</Text>
      </View>

      <View style={styles.methods}>
        {([["scan", "camera", "Scan QR code"], ["code", "receipt", "Enter code"]] as const).map(([value, icon, label]) => (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: method === value }} onPress={() => setMethod(value)} style={[styles.method, method === value && styles.methodActive]}>
            <Icon name={icon} size={18} color={method === value ? color.primary : color.muted} />
            <Text style={[styles.methodText, method === value && { color: color.primary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {method === "scan" ? (
        <View style={styles.panel}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Icon name="camera" size={34} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.bold}>QR scanning is coming soon</Text>
          <Text style={styles.smallCenter}>Customers don't have a QR code yet. Ask for their 6-digit pickup code instead.</Text>
          <Btn title="Enter code instead" variant="secondary" icon="receipt" onPress={() => setMethod("code")} style={styles.panelBtn} />
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.label}>Pickup code</Text>
          <TextInput
            accessibilityLabel="Pickup code"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6));
              setError(null);
            }}
            placeholder="482193"
            placeholderTextColor={color.muted2}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => void check()}
            style={[styles.codeInput, !!error && styles.codeError]}
          />
          <FormError>{error}</FormError>
          <Btn title="Verify code" icon="check" loading={busy} onPress={() => void check()} style={styles.panelBtn} />
          <View style={styles.secure}>
            <Icon name="shield" size={15} color={color.muted} />
            <Text style={styles.secureText}>Only valid, active reservation codes can be completed.</Text>
          </View>
        </View>
      )}
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const CORNER = { position: "absolute" as const, width: 35, height: 35, borderColor: color.light };

const styles = StyleSheet.create({
  bold: { fontSize: 14, fontWeight: "700", color: color.text, textAlign: "center" },
  small: { fontSize: 12, color: color.muted },
  smallCenter: { fontSize: 12, color: color.muted, textAlign: "center", marginTop: 4 },
  label: { fontSize: 13, fontWeight: "700", color: color.label, marginBottom: 8 },
  hero: { alignItems: "center", paddingTop: 24, paddingBottom: 18 },
  heroTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: color.text, textAlign: "center", marginTop: 14 },
  heroText: { fontSize: 13, color: color.muted, textAlign: "center", marginTop: 6 },
  intro: { paddingTop: 8, paddingBottom: 16 },
  methods: { flexDirection: "row", padding: 3, borderRadius: 13, backgroundColor: "#F4EBE2", marginBottom: 14 },
  method: { flex: 1, minHeight: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  methodActive: { backgroundColor: color.surface },
  methodText: { fontSize: 13, fontWeight: "700", color: color.muted },
  panel: { padding: 18, borderRadius: 19, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  panelBtn: { marginTop: 14 },
  scanFrame: { width: 210, height: 210, borderRadius: 18, backgroundColor: "#2A1A10", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 15 },
  corner: CORNER,
  tl: { left: 15, top: 15, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { right: 15, top: 15, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { left: 15, bottom: 15, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { right: 15, bottom: 15, borderBottomWidth: 3, borderRightWidth: 3 },
  codeInput: { height: 62, borderRadius: 14, borderWidth: 2, borderColor: color.mid, backgroundColor: color.tintSoft, textAlign: "center", fontSize: 26, fontWeight: "800", letterSpacing: 6, color: color.primaryDeep, marginBottom: 10 },
  codeError: { borderColor: color.error },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 13 },
  secureText: { fontSize: 11, color: color.muted },
  pickupOnly: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  pickupOnlyText: { fontSize: 12, color: color.primary },
  valid: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: color.tintBorder, backgroundColor: color.tintSoft, marginBottom: 14 },
  validText: { fontSize: 14, fontWeight: "700", color: color.primary },
  ticket: { padding: 16, borderRadius: 19, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  ticketId: { alignItems: "center", gap: 5, paddingBottom: 15, marginBottom: 8, borderBottomWidth: 1, borderStyle: "dashed", borderBottomColor: "#E3CFBD" },
  ticketRef: { fontSize: 19, fontWeight: "800", letterSpacing: 0.7, color: color.primary },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 7 },
  rowLabel: { fontSize: 13, color: color.muted },
  rowValue: { flex: 1, fontSize: 13, fontWeight: "700", color: color.text, textAlign: "right" },
  collect: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.softLine },
  collectLabel: { fontSize: 14, fontWeight: "700", color: color.text },
  collectValue: { fontSize: 19, fontWeight: "800", color: color.primary },
  stamp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, marginTop: 10, borderRadius: 11, backgroundColor: color.tintSoft },
  stampText: { fontSize: 13, fontWeight: "700", color: color.primary },
  warn: { fontSize: 13, lineHeight: 19, color: color.warnText, textAlign: "center", marginTop: 14 },
});
