import * as Location from "expo-location";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Owner: Sachira. Web fallback for PreferencesLocationPicker (maps are phone-only).

export type Coordinates = { latitude: number; longitude: number };

export type PreferencesLocationPickerProps = {
  value: Coordinates | null;
  radiusKm: number;
  onChange: (coords: Coordinates) => void;
  error?: string;
};

export function PreferencesLocationPicker({
  value,
  radiusKm,
  onChange,
  error,
}: PreferencesLocationPickerProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function useCurrentLocation() {
    setMessage(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission was denied.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const lat = Math.round(position.coords.latitude * 100) / 100;
      const lng = Math.round(position.coords.longitude * 100) / 100;
      onChange({ latitude: lat, longitude: lng });
    } catch {
      setMessage("Could not get your location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Button
        title="Use my current location"
        variant="secondary"
        onPress={useCurrentLocation}
        loading={busy}
      />
      {value ? (
        <View style={styles.infoBox}>
          <Text style={styles.coords}>
            📍 Approx. Lat: {value.latitude.toFixed(2)}, Lng: {value.longitude.toFixed(2)}
          </Text>
          <Text style={styles.radiusNote}>Alert radius: {radiusKm} km</Text>
        </View>
      ) : (
        <Body muted>The interactive map is shown on mobile devices.</Body>
      )}
      {message ? <Text style={styles.warningText}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  infoBox: {
    gap: 2,
    paddingVertical: 6,
  },
  coords: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333333",
  },
  radiusNote: {
    fontSize: 12,
    color: "#E65100",
    fontWeight: "500",
  },
  warningText: {
    color: theme.warning,
    fontSize: 13,
  },
});

