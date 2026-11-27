import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, type MapPressEvent, type Region } from "react-native-maps";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Owner: Sachira. Location picker with live notification radius circle overlay for preferences.

export type Coordinates = { latitude: number; longitude: number };

export type PreferencesLocationPickerProps = {
  value: Coordinates | null;
  radiusKm: number;
  onChange: (coords: Coordinates) => void;
  error?: string;
};

const SRI_LANKA: Region = {
  latitude: 7.5,
  longitude: 80.7,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

function getDeltaForRadius(radiusKm: number): number {
  // 1 degree latitude is approx 111 km. Add 40% margin to fit the full circle comfortably.
  return Math.max(0.04, (radiusKm * 2.4) / 111);
}

export function PreferencesLocationPicker({
  value,
  radiusKm,
  onChange,
  error,
}: PreferencesLocationPickerProps) {
  const map = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Animate map when location or radius changes
  useEffect(() => {
    if (value) {
      const delta = getDeltaForRadius(radiusKm);
      map.current?.animateToRegion(
        {
          latitude: value.latitude,
          longitude: value.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        350,
      );
    }
  }, [value, radiusKm]);

  async function useCurrentLocation() {
    setMessage(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission was denied. Tap the map to place the pin.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Round to 2 decimal places (~1.1 km) for privacy
      const lat = Math.round(position.coords.latitude * 100) / 100;
      const lng = Math.round(position.coords.longitude * 100) / 100;
      onChange({ latitude: lat, longitude: lng });
    } catch {
      setMessage("Could not retrieve GPS location. Tap the map to place the pin.");
    } finally {
      setBusy(false);
    }
  }

  const handleMapPress = (e: MapPressEvent) => {
    const raw = e.nativeEvent.coordinate;
    const lat = Math.round(raw.latitude * 100) / 100;
    const lng = Math.round(raw.longitude * 100) / 100;
    onChange({ latitude: lat, longitude: lng });
  };

  const delta = getDeltaForRadius(radiusKm);

  return (
    <View style={styles.container}>
      <Button
        title="Use my current location"
        variant="secondary"
        onPress={useCurrentLocation}
        loading={busy}
      />

      <MapView
        ref={map}
        style={styles.map}
        initialRegion={
          value
            ? {
                latitude: value.latitude,
                longitude: value.longitude,
                latitudeDelta: delta,
                longitudeDelta: delta,
              }
            : SRI_LANKA
        }
        onPress={handleMapPress}
      >
        {value ? (
          <>
            <Marker
              coordinate={value}
              draggable
              title="Alert center"
              description={`Alert radius: ${radiusKm} km`}
              onDragEnd={(e) => {
                const raw = e.nativeEvent.coordinate;
                onChange({
                  latitude: Math.round(raw.latitude * 100) / 100,
                  longitude: Math.round(raw.longitude * 100) / 100,
                });
              }}
            />
            <Circle
              center={value}
              radius={radiusKm * 1000}
              strokeColor="#E65100"
              strokeWidth={2}
              fillColor="rgba(230, 81, 0, 0.16)"
            />
          </>
        ) : null}
      </MapView>

      {value ? (
        <View style={styles.infoBox}>
          <Text style={styles.coords}>
            📍 Approx. Lat: {value.latitude.toFixed(2)}, Lng: {value.longitude.toFixed(2)}
          </Text>
          <Text style={styles.radiusNote}>
            Orange circle shows your {radiusKm} km alert zone.
          </Text>
        </View>
      ) : (
        <Body muted>Tap the map to place your pin or use GPS.</Body>
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
  map: {
    height: 240,
    borderRadius: theme.radius,
    overflow: "hidden",
  },
  infoBox: {
    gap: 2,
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

