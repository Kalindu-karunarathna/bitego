
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { CategoryDto, ListingDto } from "@bitego/shared";

import { createBuyerReservation } from "@/api/reservations";

import {
  fetchDiscoverCategories,
  fetchDiscoverListings,
  fetchListingDetail,
} from "@/features/discover/discoverApi";

const COLORS = {
  background: "#FFF9F4",
  surface: "#FFFFFF",
  orange: "#F47B35",
  orangeLight: "#FFF0E5",
  text: "#29231F",
  muted: "#8B8179",
  border: "#F0E5DA",
  subtle: "#F8F1EA",
};

export default function BusinessBuyScreen() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [listings, setListings] = useState<ListingDto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedListing, setSelectedListing] =
    useState<ListingDto | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [reservationQuantity, setReservationQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const router = useRouter();

  // Load categories

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const result = await fetchDiscoverCategories();

        if (active) {
          setCategories(result);
        }
      } catch (err) {
        console.warn("[BUSINESS BUY CATEGORIES ERROR]", err);
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  // Load listings visible to business buyers

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
          limit: 50,
        });

        const uniqueListings = result.items.filter(
          (listing) =>
            listing.audience === "EVERYONE" ||
            listing.audience === "BUSINESSES_ONLY",
        );

        console.log("[BUSINESS BUY]", {
          received: result.items.length,
          visible: uniqueListings.length,
          audiences: result.items.map((item) => item.audience),
        });

        setListings(uniqueListings);
      } catch (err) {
        console.error("[BUSINESS BUY ERROR]", err);

        setError(
          err instanceof Error
            ? err.message
            : "Could not load available listings. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedCategory],
  );

  // Reload when search or category changes

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadListings();
    }, 350);

    return () => clearTimeout(timer);
  }, [loadListings]);

  // Get the primary listing image

  const getPrimaryImage = (listing: ListingDto) =>
    listing.images?.find((image) => image.isPrimary) ??
    listing.images?.[0];

  // Open listing details

  const openListingDetails = async (listing: ListingDto) => {
    if (reserving) return;

    setSelectedListing(listing);
    setReservationQuantity(1);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const result = await fetchListingDetail(listing.id);
      setSelectedListing(result);
    } catch (err) {
      console.warn("[BUSINESS BUY DETAIL ERROR]", err);

      setDetailError(
        err instanceof Error
          ? err.message
          : "Could not load listing details.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // Close listing details

  const closeDetails = () => {
    if (reserving) return;

    setSelectedListing(null);
    setDetailError(null);
    setReservationQuantity(1);
  };

  // Change reservation quantity

  const decreaseQuantity = () => {
    setReservationQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQuantity = () => {
    if (!selectedListing) return;

    setReservationQuantity((current) =>
      Math.min(selectedListing.quantityAvailable, current + 1),
    );
  };

  // Reserve food

  const handleReserve = async () => {
    if (!selectedListing || reserving || detailLoading) return;

    const quantity = Number(reservationQuantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert("Invalid quantity", "Enter a valid quantity.");
      return;
    }

    if (quantity > selectedListing.quantityAvailable) {
      Alert.alert(
        "Insufficient quantity",
        `Only ${selectedListing.quantityAvailable} are available.`,
      );
      return;
    }

    if (selectedListing.quantityAvailable < 1) {
      Alert.alert(
        "Unavailable",
        "This listing currently has no available quantity.",
      );
      return;
    }

    setReserving(true);

    try {
      const reservation = await createBuyerReservation(
        selectedListing.id,
        quantity,
      );

      setSelectedListing(null);
      setReservationQuantity(1);
      setDetailError(null);

      Alert.alert(
        "Reservation successful!",
        `Your food has been reserved successfully.\n\nPickup code: ${reservation.pickupCode}`,
      );

      await loadListings(true);
    } catch (err) {
      Alert.alert(
        "Reservation failed",
        err instanceof Error
          ? err.message
          : "Unable to reserve this food. Please try again.",
      );
    } finally {
      setReserving(false);
    }
  };

  // Format price

  const formatPrice = (price: number) => {
    return price === 0 ? "FREE" : `Rs. ${price.toLocaleString("en-LK")}`;
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

  // Format pickup date

  const formatPickupDate = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
      return "Check pickup date";
    }

    return value.toLocaleDateString("en-LK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get audience label

  const getAudienceLabel = (audience: ListingDto["audience"]) => {
    return audience === "BUSINESSES_ONLY"
      ? "Business buyers"
      : "Businesses and customers";
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
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>BITEGO BUSINESS</Text>

            <Text style={styles.heading}>Buy good food.</Text>

            <Text style={styles.subtitle}>
              Discover available food from other businesses.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>🛍️</Text>
          </View>
        </View>

        {/* My Reservations */}

        <Pressable
          onPress={() => router.push("/(business)/buy/reservations")}
          style={({ pressed }) => [
            styles.reservationsButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.reservationsButtonText}>
            My Reservations
          </Text>

          <Text style={styles.reservationsButtonArrow}>→</Text>
        </Pressable>

        {/* Search */}

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search food or businesses..."
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
          <Text style={styles.sectionTitle}>Categories</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            <Pressable
              onPress={() => setSelectedCategory(undefined)}
              style={[
                styles.categoryChip,
                !selectedCategory && styles.categoryChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  !selectedCategory && styles.categoryTextSelected,
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

        {/* Listings */}

        <View style={styles.section}>
          <View style={styles.listingHeader}>
            <View>
              <Text style={styles.sectionTitle}>Available food</Text>

              <Text style={styles.sectionSubtitle}>
                Food offered by other businesses
              </Text>
            </View>

            {!loading && !error && (
              <Text style={styles.resultCount}>
                {listings.length} found
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={COLORS.orange} />

              <Text style={styles.stateText}>
                Finding available food...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>Something went wrong</Text>

              <Text style={styles.stateText}>{error}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => void loadListings()}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : listings.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.emptyEmoji}>🍱</Text>

              <Text style={styles.stateTitle}>No food available</Text>

              <Text style={styles.stateText}>
                No listings match your search right now. Try another category
                or search term.
              </Text>

              <Pressable
                onPress={() => {
                  setSearch("");
                  setSelectedCategory(undefined);
                }}
              >
                <Text style={styles.resetText}>Clear filters</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.foodList}>
              {listings.map((listing) => {
                const primaryImage = getPrimaryImage(listing);

                return (
                  <Pressable
                    key={listing.id}
                    style={({ pressed }) => [
                      styles.foodCard,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => void openListingDetails(listing)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${listing.title} details`}
                  >
                    <View style={styles.imageContainer}>
                      {primaryImage?.imageUrl ? (
                        <Image
                          source={{ uri: primaryImage.imageUrl }}
                          style={styles.foodImage}
                          resizeMode="cover"
                          onError={() =>
                            console.warn(
                              "[BUSINESS BUY IMAGE ERROR]",
                              primaryImage.imageUrl,
                            )
                          }
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Text style={styles.placeholderEmoji}>🍱</Text>
                        </View>
                      )}

                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityText}>
                          {listing.quantityAvailable} left
                        </Text>
                      </View>
                    </View>

                    <View style={styles.foodDetails}>
                      <View style={styles.cardTitleRow}>
                        <Text numberOfLines={1} style={styles.foodName}>
                          {listing.title}
                        </Text>
                      </View>

                      <Text numberOfLines={1} style={styles.shopName}>
                        {listing.business.name}
                      </Text>

                      <Text style={styles.categoryName}>
                        {listing.category.name}
                      </Text>

                      <View style={styles.priceRow}>
                        <Text style={styles.foodPrice}>
                          {formatPrice(listing.price)}
                        </Text>

                        {listing.originalPrice > listing.price && (
                          <Text style={styles.originalPrice}>
                            Rs.{" "}
                            {listing.originalPrice.toLocaleString("en-LK")}
                          </Text>
                        )}
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.pickupText}>
                          Pickup until {formatPickupTime(listing.pickupEnd)}
                        </Text>

                        <Text style={styles.viewDetails}>
                          View details →
                        </Text>
                      </View>

                      <View style={styles.audienceBadge}>
                        <Text style={styles.audienceText}>
                          {getAudienceLabel(listing.audience)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.bottomNote}>
          <Text style={styles.bottomNoteEmoji}>🧡</Text>

          <Text style={styles.bottomNoteText}>
            Better food choices for every business.
          </Text>
        </View>
      </ScrollView>

      {/* Listing details modal */}

      <Modal
        visible={selectedListing !== null}
        animationType="slide"
        transparent
        onRequestClose={closeDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>Listing details</Text>

              <Pressable
                onPress={closeDetails}
                disabled={reserving}
              >
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={COLORS.orange} />

                <Text style={styles.stateText}>Loading details...</Text>
              </View>
            ) : detailError ? (
              <View style={styles.stateContainer}>
                <Text style={styles.stateTitle}>
                  Could not load details
                </Text>

                <Text style={styles.stateText}>{detailError}</Text>

                <Pressable
                  style={styles.closeButton}
                  onPress={closeDetails}
                >
                  <Text style={styles.closeButtonText}>Close details</Text>
                </Pressable>
              </View>
            ) : selectedListing ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  const image = getPrimaryImage(selectedListing);

                  return image?.imageUrl ? (
                    <Image
                      source={{ uri: image.imageUrl }}
                      style={styles.detailImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.detailImagePlaceholder}>
                      <Text style={styles.emptyEmoji}>🍱</Text>
                    </View>
                  );
                })()}

                <View style={styles.detailContent}>
                  <Text style={styles.detailTitle}>
                    {selectedListing.title}
                  </Text>

                  <Text style={styles.detailBusiness}>
                    {selectedListing.business.name}
                  </Text>

                  <Text style={styles.detailPrice}>
                    {formatPrice(selectedListing.price)}
                  </Text>

                  {selectedListing.originalPrice >
                    selectedListing.price && (
                    <Text style={styles.detailOriginalPrice}>
                      Original price:{" "}
                      {formatPrice(selectedListing.originalPrice)}
                    </Text>
                  )}

                  <View style={styles.detailDivider} />

                  <Text style={styles.detailLabel}>Description</Text>

                  <Text style={styles.detailText}>
                    {selectedListing.description ||
                      "No description provided."}
                  </Text>

                  <Text style={styles.detailLabel}>Category</Text>

                  <Text style={styles.detailText}>
                    {selectedListing.category.name}
                  </Text>

                  <Text style={styles.detailLabel}>
                    Available quantity
                  </Text>

                  <Text style={styles.detailText}>
                    {selectedListing.quantityAvailable}{" "}
                    {selectedListing.unit.toLowerCase()}
                  </Text>

                  <Text style={styles.detailLabel}>Pickup period</Text>

                  <Text style={styles.detailText}>
                    {formatPickupDate(selectedListing.pickupStart)}
                    {"\n"}
                    {formatPickupTime(selectedListing.pickupStart)}
                    {" – "}
                    {formatPickupTime(selectedListing.pickupEnd)}
                  </Text>

                  {selectedListing.pickupNote && (
                    <>
                      <Text style={styles.detailLabel}>
                        Pickup instructions
                      </Text>

                      <Text style={styles.detailText}>
                        {selectedListing.pickupNote}
                      </Text>
                    </>
                  )}

                  <Text style={styles.detailLabel}>Business address</Text>

                  <Text style={styles.detailText}>
                    {selectedListing.business.addressLine},{" "}
                    {selectedListing.business.city}
                    {selectedListing.business.district
                      ? `, ${selectedListing.business.district}`
                      : ""}
                  </Text>

                  <Text style={styles.detailLabel}>Available to</Text>

                  <Text style={styles.detailText}>
                    {getAudienceLabel(selectedListing.audience)}
                  </Text>

                  <View style={styles.detailDivider} />

                  {/* Reservation quantity */}

                  <Text style={styles.detailLabel}>
                    Reservation quantity
                  </Text>

                  <View style={styles.quantitySelector}>
                    <Pressable
                      style={[
                        styles.quantityButton,
                        reservationQuantity <= 1 &&
                          styles.quantityButtonDisabled,
                      ]}
                      onPress={decreaseQuantity}
                      disabled={reservationQuantity <= 1 || reserving}
                    >
                      <Text style={styles.quantityButtonText}>−</Text>
                    </Pressable>

                    <Text style={styles.quantityValue}>
                      {reservationQuantity}
                    </Text>

                    <Pressable
                      style={[
                        styles.quantityButton,
                        reservationQuantity >=
                          selectedListing.quantityAvailable &&
                          styles.quantityButtonDisabled,
                      ]}
                      onPress={increaseQuantity}
                      disabled={
                        reserving ||
                        reservationQuantity >=
                          selectedListing.quantityAvailable
                      }
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </Pressable>
                  </View>

                  {/* Total price */}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total price</Text>

                    <Text style={styles.totalPrice}>
                      {formatPrice(
                        selectedListing.price * reservationQuantity,
                      )}
                    </Text>
                  </View>

                  {/* Reserve button */}

                  <Pressable
                    style={[
                      styles.reserveButton,
                      (reserving ||
                        selectedListing.quantityAvailable < 1) &&
                        styles.reserveButtonDisabled,
                    ]}
                    onPress={() => void handleReserve()}
                    disabled={
                      reserving ||
                      selectedListing.quantityAvailable < 1
                    }
                  >
                    {reserving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.reserveButtonText}>
                        {selectedListing.quantityAvailable < 1
                          ? "Currently unavailable"
                          : "Reserve food"}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.closeButton}
                    onPress={closeDetails}
                    disabled={reserving}
                  >
                    <Text style={styles.closeButtonText}>
                      Close details
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
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
    paddingTop: 22,
    paddingBottom: 36,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    marginBottom: 9,
  },

  heading: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.9,
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: COLORS.orangeLight,
    borderWidth: 1,
    borderColor: "#F9DCC8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  headerEmoji: {
    fontSize: 26,
  },

  reservationsButton: {
    backgroundColor: COLORS.orangeLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 17,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 19,
  },

  reservationsButtonText: {
    color: COLORS.orange,
    fontSize: 14,
    fontWeight: "800",
  },

  reservationsButtonArrow: {
    color: COLORS.orange,
    fontSize: 18,
    fontWeight: "700",
  },

  searchContainer: {
    height: 54,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 27,
    shadowColor: "#8B8179",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    fontSize: 22,
    padding: 5,
  },

  section: {
    marginBottom: 27,
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

  categoryList: {
    gap: 9,
    paddingRight: 20,
    paddingTop: 13,
  },

  categoryChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 10,
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

  listingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  resultCount: {
    color: COLORS.muted,
    fontSize: 12,
  },

  foodList: {
    gap: 15,
  },

  foodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#6B5140",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 8,
    elevation: 2,
  },

  imageContainer: {
    height: 190,
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

  quantityBadge: {
    position: "absolute",
    top: 13,
    left: 13,
    backgroundColor: COLORS.orangeLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F9DCC8",
  },

  quantityText: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: "800",
  },

  foodDetails: {
    padding: 18,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  foodName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },

  shopName: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },

  categoryName: {
    color: COLORS.orange,
    fontSize: 11,
    marginTop: 5,
    fontWeight: "600",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 13,
  },

  foodPrice: {
    color: COLORS.orange,
    fontSize: 22,
    fontWeight: "800",
  },

  originalPrice: {
    color: COLORS.muted,
    fontSize: 12,
    textDecorationLine: "line-through",
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    flexWrap: "wrap",
    gap: 8,
  },

  pickupText: {
    color: COLORS.muted,
    fontSize: 11,
  },

  viewDetails: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: "700",
  },

  audienceBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.subtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  audienceText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
  },

  stateContainer: {
    minHeight: 245,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 27,
    paddingVertical: 30,
    gap: 12,
    shadowColor: "#6B5140",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  stateText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
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
    fontSize: 47,
    marginBottom: 3,
  },

  resetText: {
    color: COLORS.orange,
    fontWeight: "800",
    fontSize: 13,
    marginTop: 7,
  },

  bottomNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    marginTop: 2,
  },

  bottomNoteEmoji: {
    fontSize: 16,
  },

  bottomNoteText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "500",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: COLORS.background,
    height: "90%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  modalHeading: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  modalClose: {
    color: COLORS.muted,
    fontSize: 28,
    paddingHorizontal: 5,
  },

  detailImage: {
    width: "100%",
    height: 220,
    backgroundColor: COLORS.orangeLight,
  },

  detailImagePlaceholder: {
    height: 170,
    backgroundColor: COLORS.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },

  detailContent: {
    padding: 21,
    paddingBottom: 35,
  },

  detailTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "800",
  },

  detailBusiness: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 7,
  },

  detailPrice: {
    color: COLORS.orange,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 15,
  },

  detailOriginalPrice: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  detailDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },

  detailLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 5,
  },

  detailText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
  },

  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginVertical: 12,
  },

  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  quantityButtonDisabled: {
    opacity: 0.4,
  },

  quantityButtonText: {
    color: COLORS.orange,
    fontSize: 23,
    fontWeight: "800",
  },

  quantityValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.orangeLight,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginTop: 12,
  },

  totalLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  totalPrice: {
    color: COLORS.orange,
    fontSize: 19,
    fontWeight: "800",
  },

  reserveButton: {
    backgroundColor: COLORS.orange,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: 50,
  },

  reserveButtonDisabled: {
    opacity: 0.55,
  },

  reserveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  closeButton: {
    backgroundColor: COLORS.orange,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 25,
  },

  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  cardPressed: {
    opacity: 0.92,
  },
});
 