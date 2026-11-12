import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { openDirectionsInMaps, type DirectionsOptions } from "./locationUtils";
import { validPickupCoordinates } from "./pickupRoute";

export type PickupDirectionsButtonProps = DirectionsOptions & {
  reservationId?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Reuse in the pickup screen's bottom actions, or use the map's built-in button. */
export function PickupDirectionsButton(props: PickupDirectionsButtonProps) {
  const key = [props.reservationId, props.latitude, props.longitude, props.userLatitude, props.userLongitude]
    .map(String).join("|");
  // Reset launch state when the order/location changes, including old async failures.
  return <DirectionsAction key={key} {...props} />;
}

function DirectionsAction({ disabled = false, style, ...options }: PickupDirectionsButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opening = useRef(false);
  const mounted = useRef(true);
  const validDestination = validPickupCoordinates(options);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const open = () => {
    if (disabled || !validDestination || opening.current) return;
    opening.current = true;
    setPending(true);
    setError(null);
    void openDirectionsInMaps(options).catch((failure: unknown) => {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "Could not open Google Maps. Please try again.");
    }).finally(() => {
      opening.current = false;
      if (mounted.current) setPending(false);
    });
  };
  const unavailable = disabled || !validDestination || pending;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Get directions in Google Maps"
        accessibilityState={{ disabled: unavailable, busy: pending }}
        disabled={unavailable} onPress={open} style={[styles.button, unavailable && styles.disabled]}>
        <Text style={styles.label}>{pending ? "Opening Google Maps…" : "Get directions"}</Text>
      </TouchableOpacity>
      {!validDestination || error ? <Text accessibilityRole="alert" style={styles.error}>
        {!validDestination ? "The shop location is unavailable." : error}
      </Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10,
    borderWidth: 1, borderColor: "#E65100", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "600", color: "#B84300" },
  error: { fontSize: 13, color: "#A32820" },
  disabled: { opacity: 0.5 },
});
