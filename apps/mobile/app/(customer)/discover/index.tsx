
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  fetchDiscoverCategories,
  fetchDiscoverListings,
} from "@/features/discover/discoverApi";

import type { CategoryDto, ListingDto } from "@bitego/shared";

const COLORS = {
  background: "#FFF9F1",
  surface: "#FFFFFF",
  orange: "#F47B35",
  orangeLight: "#FFF0E5",
  text: "#29231F",
  muted: "#8B8179",
  border: "#F0E5DA",
  green: "#347A48",
  greenLight: "#EAF4E9",
};

type BuyerCoordinates = {
  latitude: number;
  longitude: number;
};

export default function DiscoverScreen() {
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [listings, setListings] = useState<ListingDto[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Buyer's current GPS coordinates
  const [buyerLocation, setBuyerLocation] =
    useState<BuyerCoordinates | null>(null);

  // Location loading and permission status
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationMessage, setLocationMessage] =
    useState<string | null>(null);

  // Load food categories
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const result = await fetchDiscoverCategories();

        if (active) {
          setCategories(result);
        }
      } catch (err) {
        console.warn("[BITEGO CATEGORIES ERROR]", err);
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  // Get buyer's current location
  useEffect(() => {
    let active = true;

    async function getBuyerLocation() {
      try {
        setLocationLoading(true);
        setLocationMessage(null);

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (permission.status !== "granted") {
          setLocationMessage(
            "Location permission denied. Showing available food without distance information.",
          );
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) return;

        setBuyerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (err) {
        console.warn("[BITEGO LOCATION ERROR]", err);

        if (active) {
          setLocationMessage(
            "Could not get your location. You can still discover available food.",
          );
        }
      } finally {
        if (active) {
          setLocationLoading(false);
        }
      }
    }

    void getBuyerLocation();

    return () => {
      active = false;
    };
  }, []);

  // Load food listings
  const loadListings = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await fetchDiscoverListings({
          search: search.trim() || undefined,
          categoryId: selectedCategory,
          latitude: buyerLocation?.latitude,
          longitude: buyerLocation?.longitude,
          limit: 20,
        });

        console.log("[BITEGO DISCOVER]", {
          count: result.items.length,
          firstListing: result.items[0],
        });

        setListings(result.items);
      } catch (err) {
        console.error("[BITEGO DISCOVER ERROR]", {
          message:
            err instanceof Error ? err.message : String(err),
          status:
            typeof err === "object" &&
            err !== null &&
            "status" in err
              ? err.status
              : undefined,
          code:
            typeof err === "object" &&
            err !== null &&
            "code" in err
              ? err.code
              : undefined,
        });

        setError(
          err instanceof Error
            ? err.message
            : "Could not load food listings. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedCategory, buyerLocation],
  );

  // Reload listings when search, category or GPS changes
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadListings();
    }, 350);

    return () => clearTimeout(timer);
  }, [loadListings]);

  // Format price in Sri Lankan Rupees
  const formatPrice = (price: number) => {
    return price === 0
      ? "FREE"
      : `Rs. ${price.toLocaleString("en-LK")}`;
  };

  // Format pickup time
  const formatPickupTime = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
      return "Check pickup time";
    }

    return value.toLocaleTimeString("en-LK", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadListings(true)}
            tintColor={COLORS.orange}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BITEGO</Text>

            <Text style={styles.greeting}>
              Discover good food.
            </Text>

            <Text style={styles.subtitle}>
              Great meals, better prices, less waste.
            </Text>
          </View>

          <View style={styles.notification}>
            <Text style={styles.notificationIcon}>♧</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search food or shops..."
            placeholderTextColor="#A99E94"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          )}
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Categories
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            <Pressable
              onPress={() => setSelectedCategory(undefined)}
              style={[
                styles.categoryChip,
                !selectedCategory &&
                  styles.categoryChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  !selectedCategory &&
                    styles.categoryTextSelected,
                ]}
              >
                All food
              </Text>
            </Pressable>

            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === category.id
                      ? undefined
                      : category.id,
                  )
                }
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id &&
                    styles.categoryChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category.id &&
                      styles.categoryTextSelected,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Available listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Available near you
              </Text>

              <Text style={styles.sectionSubtitle}>
                Fresh finds waiting to be picked up
              </Text>
            </View>

            <Text style={styles.foodEmoji}>🍜</Text>
          </View>

          {/* Location status */}
          {locationLoading ? (
            <Text style={styles.locationStatus}>
              Getting your location...
            </Text>
          ) : locationMessage ? (
            <Text style={styles.locationStatus}>
              {locationMessage}
            </Text>
          ) : buyerLocation ? (
            <Text style={styles.locationStatus}>
              Showing distances from your current location
            </Text>
          ) : null}

          {/* Loading state */}
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator
                size="large"
                color={COLORS.orange}
              />

              <Text style={styles.stateText}>
                Finding good food...
              </Text>
            </View>
          ) : error ? (
            /* Error state */
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>
                Something went wrong
              </Text>

              <Text style={styles.stateText}>
                {error}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => void loadListings()}
              >
                <Text style={styles.retryText}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : listings.length === 0 ? (
            /* Empty state */
            <View style={styles.stateContainer}>
              <Text style={styles.emptyEmoji}>🥗</Text>

              <Text style={styles.stateTitle}>
                No food found
              </Text>

              <Text style={styles.stateText}>
                Try another search or category.
              </Text>

              <Pressable
                onPress={() => {
                  setSearch("");
                  setSelectedCategory(undefined);
                }}
              >
                <Text style={styles.resetText}>
                  Clear filters
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Food cards */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.foodList}
            >
              {listings.map((listing) => {
                const primaryImage =
                  listing.images?.find(
                    (image) => image.isPrimary,
                  ) ?? listing.images?.[0];

                return (
                  <Pressable
                    key={listing.id}
                    style={styles.foodCard}
                    onPress={() =>
                      router.push({
                        pathname:
                          "/(customer)/discover/[listingId]",
                        params: {
                          listingId: listing.id,
                        },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View ${listing.title} details`}
                  >
                    {/* Food image */}
                    <View style={styles.imageContainer}>
                      {primaryImage?.imageUrl ? (
                        <Image
                          source={{
                            uri: primaryImage.imageUrl,
                          }}
                          style={styles.foodImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Text style={styles.placeholderEmoji}>
                            🍱
                          </Text>
                        </View>
                      )}

                      <View style={styles.availableBadge}>
                        <Text style={styles.availableBadgeText}>
                          {listing.quantityAvailable} left
                        </Text>
                      </View>
                    </View>

                    {/* Food details */}
                    <View style={styles.foodDetails}>
                      <Text
                        numberOfLines={1}
                        style={styles.foodName}
                      >
                        {listing.title}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={styles.shopName}
                      >
                        {listing.business.name}
                      </Text>

                      {/* Price */}
                      <View style={styles.priceRow}>
                        <Text style={styles.foodPrice}>
                          {formatPrice(listing.price)}
                        </Text>

                        {listing.originalPrice >
                          listing.price && (
                          <Text style={styles.originalPrice}>
                            Rs.{" "}
                            {listing.originalPrice.toLocaleString(
                              "en-LK",
                            )}
                          </Text>
                        )}
                      </View>

                      {/* Pickup time */}
                      <View style={styles.pickupRow}>
                        <Text style={styles.pickupIcon}>
                          ◷
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={styles.pickupText}
                        >
                          Until{" "}
                          {formatPickupTime(listing.pickupEnd)}
                        </Text>
                      </View>

                      {/* Buyer-to-shop distance */}
                      {listing.business.distanceKm !==
                        undefined &&
                        listing.business.distanceKm !== null && (
                          <Text style={styles.distanceText}>
                            ⌖{" "}
                            {listing.business.distanceKm.toFixed(
                              1,
                            )}{" "}
                            km away
                          </Text>
                        )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Bottom note */}
        <View style={styles.bottomNote}>
          <Text style={styles.bottomNoteEmoji}>💚</Text>

          <Text style={styles.bottomNoteText}>
            Every meal saved makes a difference.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  eyebrow: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 7,
  },

  greeting: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },

  notification: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationIcon: {
    fontSize: 24,
    color: COLORS.text,
  },

  searchContainer: {
    height: 54,
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 25,
  },

  searchIcon: {
    fontSize: 27,
    color: COLORS.orange,
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },

  clearSearch: {
    color: COLORS.muted,
    fontSize: 18,
    padding: 5,
  },

  section: {
    marginBottom: 27,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  foodEmoji: {
    fontSize: 23,
  },

  locationStatus: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16,
  },

  categoryList: {
    gap: 9,
    paddingRight: 20,
  },

  categoryChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },

  categoryChipSelected: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  },

  categoryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  categoryTextSelected: {
    color: "#FFFFFF",
  },

  foodList: {
    gap: 14,
    paddingRight: 20,
  },

  foodCard: {
    width: 225,
    backgroundColor: COLORS.surface,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  imageContainer: {
    height: 145,
    backgroundColor: COLORS.orangeLight,
  },

  foodImage: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderEmoji: {
    fontSize: 48,
  },

  availableBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: COLORS.greenLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  availableBadgeText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "800",
  },

  foodDetails: {
    padding: 13,
  },

  foodName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  shopName: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  foodPrice: {
    color: COLORS.orange,
    fontSize: 17,
    fontWeight: "800",
  },

  originalPrice: {
    color: COLORS.muted,
    fontSize: 11,
    textDecorationLine: "line-through",
  },

  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
    gap: 5,
  },

  pickupIcon: {
    color: COLORS.orange,
    fontSize: 15,
  },

  pickupText: {
    color: COLORS.muted,
    fontSize: 11,
  },

  distanceText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  stateContainer: {
    minHeight: 190,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    gap: 10,
  },

  stateTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },

  stateText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  retryButton: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 5,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  emptyEmoji: {
    fontSize: 36,
  },

  resetText: {
    color: COLORS.orange,
    fontWeight: "700",
    marginTop: 5,
  },

  bottomNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },

  bottomNoteEmoji: {
    fontSize: 15,
  },

  bottomNoteText: {
    color: COLORS.muted,
    fontSize: 12,
  },
});
