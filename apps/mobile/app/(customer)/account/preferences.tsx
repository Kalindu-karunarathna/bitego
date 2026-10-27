import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LocationPicker, type Coordinates } from "@/components/LocationPicker";
import {
  Banner,
  Body,
  Button,
  Card,
  Heading,
  Loading,
  Screen,
  Spacer,
  Title,
} from "@/components/ui";
import { usePreferences } from "@/features/preferences/usePreferences";
import { theme } from "@/lib/theme";

// Owner: Sachira. Notification preferences screen for customers.

const RADIUS_OPTIONS = [1, 3, 5, 10, 20, 50];

export default function PreferencesScreen() {
  const router = useRouter();
  const { preferences, categories, loading, saving, error, successMessage, save } =
    usePreferences();

  const [enabled, setEnabled] = useState(true);
  const [radiusKm, setRadiusKm] = useState(3);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Sync initial state from loaded preferences
  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.notificationsEnabled);
      setRadiusKm(preferences.notifyRadiusKm);
      setSelectedCategoryIds(preferences.preferredCategories.map((c) => c.id));
      if (
        preferences.approxLatitude !== null &&
        preferences.approxLongitude !== null
      ) {
        setCoords({
          latitude: preferences.approxLatitude,
          longitude: preferences.approxLongitude,
        });
      } else {
        setCoords(null);
      }
    }
  }, [preferences]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    await save({
      notificationsEnabled: enabled,
      notifyRadiusKm: radiusKm,
      preferredCategoryIds: selectedCategoryIds,
      approxLatitude: coords ? coords.latitude : null,
      approxLongitude: coords ? coords.longitude : null,
    });
  };

  if (loading && !preferences) {
    return <Loading label="Loading preferences..." />;
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Title>Alert Preferences</Title>
      </View>

      <Body muted>
        Customize which surplus food listings you get notified about and how close they must be.
      </Body>

      {successMessage ? <Banner tone="info">{successMessage}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Spacer size={theme.space.sm} />

      {/* Notifications Master Toggle */}
      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.cardTitle}>Enable notifications</Text>
            <Body muted>Receive alerts for surplus food and reservations.</Body>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: theme.border, true: "#E65100" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      {/* Matching Radius */}
      <Heading>Search Radius</Heading>
      <Card>
        <Text style={styles.cardTitle}>Alert distance: {radiusKm} km</Text>
        <Body muted>Notify me about surplus listings within this distance from my location.</Body>
        <View style={styles.chipsRow}>
          {RADIUS_OPTIONS.map((km) => {
            const isSelected = km === radiusKm;
            return (
              <Pressable
                key={km}
                accessibilityRole="button"
                onPress={() => setRadiusKm(km)}
                style={[styles.radiusChip, isSelected && styles.selectedChip]}
              >
                <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                  {km} km
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Preferred Categories */}
      <Heading>Favorite Categories</Heading>
      <Card>
        <Body muted>
          {selectedCategoryIds.length === 0
            ? "All categories selected (default). Tap to filter to specific foods."
            : `${selectedCategoryIds.length} categor${selectedCategoryIds.length === 1 ? "y" : "ies"} selected:`}
        </Body>
        <View style={styles.chipsRow}>
          {categories.map((cat) => {
            const isSelected = selectedCategoryIds.includes(cat.id);
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="button"
                onPress={() => toggleCategory(cat.id)}
                style={[styles.categoryChip, isSelected && styles.selectedCategoryChip]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.selectedCategoryChipText,
                  ]}
                >
                  {isSelected ? `✓ ${cat.name}` : cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedCategoryIds.length > 0 ? (
          <Pressable onPress={() => setSelectedCategoryIds([])} style={styles.clearLink}>
            <Text style={styles.clearLinkText}>Reset to all categories</Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Approximate Location */}
      <Heading>Approximate Location</Heading>
      <Card>
        <Body muted>
          Used to calculate nearby surplus listings. Your exact position is never stored —
          coordinates are rounded to ~1 km for privacy.
        </Body>

        {coords ? (
          <View style={styles.coordsBox}>
            <Text style={styles.coordsText}>
              📍 Approx. Lat: {coords.latitude.toFixed(2)}, Lng: {coords.longitude.toFixed(2)}
            </Text>
            <Pressable onPress={() => setCoords(null)} hitSlop={6}>
              <Text style={styles.removeLocationText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.noLocationText}>No custom location set (uses default area).</Text>
        )}

        <Button
          title={showLocationPicker ? "Hide map" : coords ? "Adjust location on map" : "Set location on map"}
          variant="secondary"
          onPress={() => setShowLocationPicker((prev) => !prev)}
        />

        {showLocationPicker ? (
          <View style={styles.mapContainer}>
            <LocationPicker
              value={coords}
              onChange={(newCoords) => setCoords(newCoords)}
            />
          </View>
        ) : null}
      </Card>

      <Spacer size={theme.space.md} />

      {/* Save Button */}
      <Button
        title="Save Preferences"
        onPress={handleSave}
        loading={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    gap: 8,
    marginBottom: 4,
  },
  backButton: {
    fontSize: 16,
    color: "#E65100",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  radiusChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  selectedChip: {
    backgroundColor: "#E65100",
    borderColor: "#E65100",
  },
  chipText: {
    fontSize: 14,
    color: theme.text,
  },
  selectedChipText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  categoryChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  selectedCategoryChip: {
    backgroundColor: "#FFEAD9",
    borderColor: "#E65100",
  },
  selectedCategoryChipText: {
    color: "#E65100",
    fontWeight: "700",
  },
  clearLink: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  clearLinkText: {
    fontSize: 13,
    color: "#E65100",
    fontWeight: "600",
  },
  coordsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F2EFE9",
    borderRadius: 8,
    marginTop: 6,
  },
  coordsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444444",
  },
  removeLocationText: {
    fontSize: 13,
    color: theme.danger,
    fontWeight: "600",
  },
  noLocationText: {
    fontSize: 13,
    color: theme.muted,
    fontStyle: "italic",
    marginVertical: 4,
  },
  mapContainer: {
    marginTop: 10,
  },
});

