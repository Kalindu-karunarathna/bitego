import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Lets a business set its shop location: press "Use my current location" while at the shop,
// then tap the map or drag the pin to adjust. The saved latitude/longitude are used for distance search.
// (The browser build uses LocationPicker.web.tsx, which has the button but no map.)

export type Coordinates = { latitude: number; longitude: number };

const SRI_LANKA: Region = { latitude: 7.5, longitude: 80.7, latitudeDelta: 4, longitudeDelta: 4 };

export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: Coordinates | null;
  onChange: (c: Coordinates) => void;
  error?: string;
}) {
  const map = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (value) map.current?.animateToRegion({ ...value, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
  }, [value]);

  async function useCurrentLocation() {
    setMessage(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission was denied. Allow it in your phone settings, or place the pin on the map.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setMessage("Could not get your location. Turn on GPS, or place the pin on the map.");
    } finally {
      setBusy(false);
    }
  }

  const onMapPress = (e: MapPressEvent) => onChange(e.nativeEvent.coordinate);

  return (
    <View style={{ gap: 8 }}>
      <Button title="Use my current location" variant="secondary" onPress={useCurrentLocation} loading={busy} />
      <MapView
        ref={map}
        style={styles.map}
        initialRegion={value ? { ...value, latitudeDelta: 0.01, longitudeDelta: 0.01 } : SRI_LANKA}
        onPress={onMapPress}
      >
        {value ? (
          <Marker coordinate={value} draggable onDragEnd={(e) => onChange(e.nativeEvent.coordinate)} />
        ) : null}
      </MapView>
      {value ? (
        <Text style={styles.coords}>
          Latitude {value.latitude.toFixed(5)}, longitude {value.longitude.toFixed(5)}
        </Text>
      ) : (
        <Body muted>Tap the map to place the pin, or use your current location.</Body>
      )}
      {message ? <Text style={{ color: theme.warning, fontSize: 13 }}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 220, borderRadius: theme.radius, overflow: "hidden" },
  coords: { fontSize: 13, color: theme.muted },
});
