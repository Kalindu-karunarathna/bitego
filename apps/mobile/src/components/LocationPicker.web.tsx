import * as Location from "expo-location";
import { useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Browser version of LocationPicker: react-native-maps does not run in a browser,
// so this has only the "Use my current location" button. The phone app shows the map.

export type Coordinates = { latitude: number; longitude: number };

export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: Coordinates | null;
  onChange: (c: Coordinates) => void;
  error?: string;
}) {
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
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setMessage("Could not get your location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Button title="Use my current location" variant="secondary" onPress={useCurrentLocation} loading={busy} />
      {value ? (
        <Text style={{ fontSize: 13, color: theme.muted }}>
          Latitude {value.latitude.toFixed(5)}, longitude {value.longitude.toFixed(5)}
        </Text>
      ) : (
        <Body muted>The map is shown in the phone app.</Body>
      )}
      {message ? <Text style={{ color: theme.warning, fontSize: 13 }}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
