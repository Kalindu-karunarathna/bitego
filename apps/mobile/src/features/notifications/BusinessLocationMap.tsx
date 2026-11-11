import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import {
  calculateDistanceKm,
  estimateTravelTimes,
  formatDistance,
  openDirectionsInMaps,
  type TravelTimeEstimate,
} from "./locationUtils";

// Owner: Sachira.
// Reusable business location map component for listing detail screens.
// Displays the seller shop's location pin, distance from customer, estimated ETA,
// and a one-tap button to launch turn-by-turn directions.

export type BusinessLocationMapProps = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  userLatitude?: number;
  userLongitude?: number;
  height?: number;
  interactive?: boolean;
};

export function BusinessLocationMap({
  latitude,
  longitude,
  name,
  address,
  userLatitude,
  userLongitude,
  height = 200,
  interactive = false,
}: BusinessLocationMapProps) {
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    userLatitude !== undefined && userLongitude !== undefined
      ? { latitude: userLatitude, longitude: userLongitude }
      : null,
  );

  // If user coordinates weren't passed as props, attempt a passive location lookup
  useEffect(() => {
    if (userLatitude !== undefined && userLongitude !== undefined) {
      setUserCoords({ latitude: userLatitude, longitude: userLongitude });
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted" && isMounted) {
          const loc = await Location.getLastKnownPositionAsync();
          if (loc && isMounted) {
            setUserCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch {
        // Passive check fails silently
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userLatitude, userLongitude]);

  const distanceKm = userCoords
    ? calculateDistanceKm(userCoords.latitude, userCoords.longitude, latitude, longitude)
    : null;

  const travelTimes: TravelTimeEstimate | null = distanceKm
    ? estimateTravelTimes(distanceKm)
    : null;

  const initialRegion: Region = {
    latitude,
    longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const handleOpenDirections = () => {
    void openDirectionsInMaps({
      latitude,
      longitude,
      name,
    });
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <View style={[styles.mapWrapper, { height }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{ latitude, longitude }}
            title={name}
            description={address ?? "Pickup location"}
            pinColor="#E65100"
          />
        </MapView>
      </View>

      {/* Info and Actions Card */}
      <View style={styles.infoCard}>
        <View style={styles.headerRow}>
          <Text style={styles.shopIcon}>🏪</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.shopName} numberOfLines={1}>
              {name}
            </Text>
            {address ? (
              <Text style={styles.addressText} numberOfLines={1}>
                {address}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Distance & ETA Row (if user location available) */}
        {distanceKm !== null && travelTimes !== null && (
          <View style={styles.metaRow}>
            <Text style={styles.metaPill}>📍 {formatDistance(distanceKm)} away</Text>
            <Text style={styles.metaPill}>🚗 ~{travelTimes.driveMinutes} min</Text>
            <Text style={styles.metaPill}>🚶 ~{travelTimes.walkMinutes} min</Text>
          </View>
        )}

        {/* Directions Button */}
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={handleOpenDirections}
          activeOpacity={0.85}
        >
          <Text style={styles.directionsButtonText}>🗺️ Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBE3D5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginVertical: 10,
  },
  mapWrapper: {
    width: "100%",
    backgroundColor: "#EDE8DD",
  },
  infoCard: {
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  shopIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C1810",
  },
  addressText: {
    fontSize: 13,
    color: "#795548",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  metaPill: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E65100",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  directionsButton: {
    backgroundColor: "#E65100",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  directionsButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
