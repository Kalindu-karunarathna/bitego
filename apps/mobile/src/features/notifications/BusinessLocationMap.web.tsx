import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  calculateDistanceKm,
  estimateTravelTimes,
  formatDistance,
  openDirectionsInMaps,
  type TravelTimeEstimate,
} from "./locationUtils";
import type { BusinessLocationMapProps } from "./BusinessLocationMap";

// Owner: Sachira. Web-specific fallback for BusinessLocationMap.
// Renders an embedded interactive map on Web without depending on native react-native-maps.

export function BusinessLocationMap({
  latitude,
  longitude,
  name,
  address,
  userLatitude,
  userLongitude,
  height = 200,
}: BusinessLocationMapProps) {
  const hasUserCoords = userLatitude !== undefined && userLongitude !== undefined;
  const distanceKm = hasUserCoords
    ? calculateDistanceKm(userLatitude, userLongitude, latitude, longitude)
    : null;

  const travelTimes: TravelTimeEstimate | null = distanceKm
    ? estimateTravelTimes(distanceKm)
    : null;

  const handleOpenDirections = () => {
    void openDirectionsInMaps({
      latitude,
      longitude,
      name,
    });
  };

  const embedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <View style={styles.container}>
      {/* Web Map Embed */}
      <View style={[styles.mapWrapper, { height }]}>
        <iframe
          title={name}
          src={embedUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          loading="lazy"
        />
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

        {/* Distance & ETA Row */}
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

