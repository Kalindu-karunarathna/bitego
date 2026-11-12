import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDistance } from "./locationUtils";
import type { PickupRoute } from "./pickupRoute";

type Props = {
  name: string;
  address?: string;
  status: "locating" | "routing" | "ready" | "error";
  route: PickupRoute | null;
  message: string | null;
  onRetry: () => void;
};

export function PickupMapStatus({ name, address, status, route, message, onRetry }: Props) {
  const busy = status === "locating" || status === "routing";
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      {address ? <Text style={styles.address}>{address}</Text> : null}
      <Text style={styles.legend}>Blue: your location · Orange: pickup shop</Text>
      <View accessibilityLiveRegion="polite">
        {status === "locating" ? <Text style={styles.detail}>Finding your location…</Text> : null}
        {status === "routing" ? <Text style={styles.detail}>Finding a driving route…</Text> : null}
        {status === "ready" && route ? (
          <Text style={styles.distance}>
            {formatDistance(route.distanceMeters / 1000)} by road · About {Math.max(1, Math.ceil(route.durationSeconds / 60))} min driving
          </Text>
        ) : null}
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onRetry}
        style={[styles.button, busy && styles.disabled]}>
        <Text style={styles.buttonText}>{status === "ready" ? "Refresh route" : "Try again"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8, backgroundColor: "#FFFFFF" },
  name: { fontSize: 16, fontWeight: "700", color: "#2C1810" },
  address: { fontSize: 13, color: "#795548" },
  legend: { fontSize: 12, color: "#5C5C5C" },
  detail: { fontSize: 13, color: "#5C5C5C" },
  distance: { fontSize: 14, fontWeight: "600", color: "#C34C00" },
  error: { fontSize: 13, color: "#A32820" },
  button: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#FFF3E0" },
  buttonText: { color: "#A63D00", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
