
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import type {
  CategoryDto,
  ListingDto,
} from "@bitego/shared";

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
  green: "#347A48",
  greenLight: "#EAF4E9",
};

export default function BusinessBuyScreen() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [listings, setListings] = useState<ListingDto[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<string | undefined>();

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedListing, setSelectedListing] =
    useState<ListingDto | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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
        const filters = {
          search: search.trim() || undefined,
          categoryId: selectedCategory,
          limit: 50,
        };

        // Business buyers can see:
        // 1. Listings for businesses only
        // 2. Listings available to everyone
        const [businessListings, sharedListings] =
          await Promise.all([
            fetchDiscoverListings({
              ...filters,
              audience: "BUSINESSES_ONLY",
            }),
            fetchDiscoverListings({
              ...filters,
              audience: "EVERYONE",
            }),
          ]);

        // Merge without duplicates and keep the newest first.
        const uniqueListings = new Map<string, ListingDto>();

        for (const listing of [
          ...businessListings.items,
          ...sharedListings.items,
        ]) {
          if (
            listing.audience === "BUSINESSES_ONLY" ||
            listing.audience === "EVERYONE"
          ) {
            uniqueListings.set(listing.id, listing);
          }
        }

        const result = Array.from(uniqueListings.values()).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        );

        console.log("[BUSINESS BUY]", {
          businessOnly: businessListings.items.length,
          everyone: sharedListings.items.length,
          total: result.length,
        });

        setListings(result);
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

  // Open listing details
  const openListingDetails = async (listing: ListingDto) => {
    setSelectedListing(listing);
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

  const closeDetails = () => {
    setSelectedListing(null);
    setDetailError(null);
  };

  // Format price
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

            <Text style={styles.heading}>
              Buy good food.
            </Text>

            <Text style={styles.subtitle}>
              Discover available food from other businesses.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>🛍️</Text>
          </View>
        </View>

        {/* Visibility information */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>✓</Text>

          <Text style={styles.infoText}>
            Showing listings available to business buyers.
          </Text>
        </View>

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
          <Text style={styles.sectionTitle}>
            Categories
          </Text>

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
              <Text style={styles.sectionTitle}>
                Available food
              </Text>

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
              <ActivityIndicator
                size="large"
                color={COLORS.orange}
              />

              <Text style={styles.stateText}>
                Finding available food...
              </Text>
            </View>
          ) : error ? (
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
            <View style={styles.stateContainer}>
              <Text style={styles.emptyEmoji}>🍱</Text>

              <Text style={styles.stateTitle}>
                No food available
              </Text>

              <Text style={styles.stateText}>
                No listings match your search right now.
                Try another category or search term.
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
            <View style={styles.foodList}>
              {listings.map((listing) => {
                const primaryImage =
                  listing.images.find(
                    (image) => image.isPrimary,
                  ) ?? listing.images[0];

                return (
                  <Pressable
                    key={listing.id}
                    style={styles.foodCard}
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
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Text style={styles.placeholderEmoji}>
                            🍱
                          </Text>
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
                        <Text
                          numberOfLines={1}
                          style={styles.foodName}
                        >
                          {listing.title}
                        </Text>
                      </View>

                      <Text
                        numberOfLines={1}
                        style={styles.shopName}
                      >
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
                            {listing.originalPrice.toLocaleString(
                              "en-LK",
                            )}
                          </Text>
                        )}
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.pickupText}>
                          Pickup until{" "}
                          {formatPickupTime(listing.pickupEnd)}
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
          <Text style={styles.bottomNoteEmoji}>💚</Text>

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
              <Text style={styles.modalHeading}>
                Listing details
              </Text>

              <Pressable onPress={closeDetails}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.orange}
                />

                <Text style={styles.stateText}>
                  Loading details...
                </Text>
              </View>
            ) : detailError ? (
              <View style={styles.stateContainer}>
                <Text style={styles.stateTitle}>
                  Could not load details
                </Text>

                <Text style={styles.stateText}>
                  {detailError}
                </Text>
              </View>
            ) : selectedListing ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
              >
                {(() => {
                  const image =
                    selectedListing.images.find(
                      (item) => item.isPrimary,
                    ) ?? selectedListing.images[0];

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

                  <Text style={styles.detailLabel}>
                    Description
                  </Text>

                  <Text style={styles.detailText}>
                    {selectedListing.description ||
                      "No description provided."}
                  </Text>

                  <Text style={styles.detailLabel}>
                    Category
                  </Text>

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

                  <Text style={styles.detailLabel}>
                    Pickup period
                  </Text>

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

                  <Text style={styles.detailLabel}>
                    Business address
                  </Text>

                  <Text style={styles.detailText}>
                    {selectedListing.business.addressLine},{" "}
                    {selectedListing.business.city}
                    {selectedListing.business.district
                      ? `, ${selectedListing.business.district}`
                      : ""}
                  </Text>

                  <Text style={styles.detailLabel}>
                    Available to
                  </Text>

                  <Text style={styles.detailText}>
                    {getAudienceLabel(selectedListing.audience)}
                  </Text>

                  <Pressable
                    style={styles.closeButton}
                    onPress={closeDetails}
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
    paddingTop: 18,
    paddingBottom: 36,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 7,
  },

  heading: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  headerEmoji: {
    fontSize: 24,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.greenLight,
    padding: 13,
    borderRadius: 14,
    marginBottom: 20,
    gap: 9,
  },

  infoIcon: {
    color: COLORS.green,
    fontSize: 17,
    fontWeight: "800",
  },

  infoText: {
    flex: 1,
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "600",
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
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  imageContainer: {
    height: 175,
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
    top: 12,
    left: 12,
    backgroundColor: COLORS.greenLight,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  quantityText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "800",
  },

  foodDetails: {
    padding: 15,
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
  },

  shopName: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
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
    fontSize: 19,
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
    marginTop: 13,
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
    backgroundColor: COLORS.greenLight,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 12,
  },

  audienceText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "700",
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
    fontSize: 38,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: COLORS.background,
    height: "88%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
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
    padding: 20,
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
});
