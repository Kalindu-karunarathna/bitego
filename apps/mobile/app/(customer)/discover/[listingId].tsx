import { ReportButton } from "@/features/reports/ReportButton";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiRequestError } from "@/api/client";
import { createBuyerReservation } from "@/api/reservations";
import { fetchListingDetail } from "@/features/discover/discoverApi";

import type { ListingDto } from "@bitego/shared";

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
  red: "#D9534F",
};

function formatPrice(value: number) {
  if (value === 0) return "FREE";

  return `Rs. ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ListingDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    listingId?: string | string[];
  }>();

  const listingId = Array.isArray(params.listingId)
    ? params.listingId[0]
    : params.listingId;

  const [listing, setListing] = useState<ListingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadListing() {
      if (!listingId) {
        setError("Invalid food listing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await fetchListingDetail(listingId);

        if (active) {
          setListing(result);
          setQuantity(1);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Unable to load food details. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadListing();

    return () => {
      active = false;
    };
  }, [listingId, retryKey]);

  const available = listing?.quantityAvailable ?? 0;
  const total = (listing?.price ?? 0) * quantity;

  const discount =
    listing && listing.originalPrice > listing.price
      ? Math.round(
          ((listing.originalPrice - listing.price) /
            listing.originalPrice) *
            100,
        )
      : 0;

  async function handleReservation() {
    if (!listing || reserving) return;

    if (quantity < 1 || quantity > listing.quantityAvailable) {
      Alert.alert(
        "Invalid quantity",
        "Please select a quantity within the available stock.",
      );
      return;
    }

    try {
      setReserving(true);

      const reservation = await createBuyerReservation(
        listing.id,
        quantity,
      );

      Alert.alert(
        "Reservation confirmed!",
        `Your food has been reserved successfully.\n\nPickup code: ${reservation.pickupCode}`,
        [
          {
            text: "View reservations",
            onPress: () =>
              router.push("/(customer)/reservations"),
          },
          {
            text: "Continue browsing",
            style: "cancel",
          },
        ],
      );
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "Something went wrong. Please try again.";

      Alert.alert("Reservation failed", message);
    } finally {
      setReserving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.orange} />
        <Text style={styles.loadingText}>
          Loading food details...
        </Text>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Unable to load listing
        </Text>

        <Text style={styles.mutedText}>
          {error ?? "This listing could not be found."}
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => setRetryKey((value) => value + 1)}
        >
          <Text style={styles.primaryButtonText}>
            Try again
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const primaryImage =
    listing.images.find((image) => image.isPrimary) ??
    listing.images[0];

  const location = [
    listing.business.addressLine,
    listing.business.city,
    listing.business.district,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backCircle}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Food details</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroContainer}>
          {primaryImage?.imageUrl ? (
            <Image
              source={{ uri: primaryImage.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.placeholderEmoji}>🍱</Text>
              <Text style={styles.mutedText}>
                No food image available
              </Text>
            </View>
          )}

          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                {discount}% OFF
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.category}>
            {listing.category.name}
          </Text>

          <Text style={styles.foodName}>
            {listing.title}
          </Text>

          <Text style={styles.description}>
            {listing.description ||
              "Freshly available food from a local business."}
          </Text>

          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>
              {formatPrice(listing.price)}
            </Text>

            {listing.originalPrice > listing.price && (
              <Text style={styles.originalPrice}>
                {formatPrice(listing.originalPrice)}
              </Text>
            )}

            <Text style={styles.perUnit}>
              / {listing.unit}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
  <Text style={styles.cardTitle}>
    Seller information
  </Text>

  <Text style={styles.shopName}>
    {listing.business.name}
  </Text>

  <Text style={styles.address}>
    {location}
  </Text>

  <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
    <ReportButton listingId={listing.id} />
  </View>
</View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>
            Seller information
          </Text>

          <Text style={styles.shopName}>
            {listing.business.name}
          </Text>

          <Text style={styles.address}>
            {location}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>
            Choose quantity
          </Text>

          <View style={styles.quantityRow}>
            <Text style={styles.infoLabel}>
              Quantity ({listing.unit})
            </Text>

            <View style={styles.quantityControls}>
              <Pressable
                onPress={() =>
                  setQuantity((value) => Math.max(1, value - 1))
                }
                disabled={quantity <= 1}
                style={[
                  styles.quantityButton,
                  quantity <= 1 && styles.disabledButton,
                ]}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </Pressable>

              <Text style={styles.quantityValue}>
                {quantity}
              </Text>

              <Pressable
                onPress={() =>
                  setQuantity((value) =>
                    Math.min(available, value + 1),
                  )
                }
                disabled={quantity >= available}
                style={[
                  styles.quantityButton,
                  quantity >= available && styles.disabledButton,
                ]}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Total amount
            </Text>

            <Text style={styles.totalValue}>
              {formatPrice(total)}
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerLabel}>
            Total
          </Text>
          <Text style={styles.footerTotal}>
            {formatPrice(total)}
          </Text>
        </View>

        <Pressable
          onPress={() => void handleReservation()}
          disabled={available <= 0 || reserving}
          style={[
            styles.reserveButton,
            (available <= 0 || reserving) &&
              styles.reserveDisabled,
          ]}
        >
          {reserving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.reserveButtonText}>
              {available <= 0
                ? "Out of stock"
                : "Reserve food"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 10,
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: "center",
  },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 30,
    color: COLORS.text,
    lineHeight: 34,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
  },
  heroContainer: {
    height: 230,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.orangeLight,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 55,
    marginBottom: 8,
  },
  discountBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    paddingVertical: 20,
  },
  category: {
    color: COLORS.orange,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 7,
  },
  foodName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 9,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  currentPrice: {
    color: COLORS.orange,
    fontSize: 22,
    fontWeight: "800",
  },
  originalPrice: {
    color: COLORS.muted,
    fontSize: 14,
    textDecorationLine: "line-through",
    marginLeft: 10,
  },
  perUnit: {
    color: COLORS.muted,
    fontSize: 12,
    marginLeft: 5,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 13,
    flexShrink: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 12,
  },
  noteContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  noteText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  shopName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  address: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  quantityButton: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: COLORS.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.35,
  },
  quantityButtonText: {
    color: COLORS.orange,
    fontSize: 22,
    fontWeight: "700",
  },
  quantityValue: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    minWidth: 20,
    textAlign: "center",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  totalValue: {
    color: COLORS.orange,
    fontSize: 17,
    fontWeight: "800",
  },
  bottomSpacing: {
    height: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 13,
    paddingBottom: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerPrice: {
    flex: 1,
  },
  footerLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  footerTotal: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 3,
  },
  reserveButton: {
    backgroundColor: COLORS.orange,
    borderRadius: 13,
    paddingHorizontal: 27,
    paddingVertical: 15,
    minWidth: 155,
    alignItems: "center",
  },
  reserveDisabled: {
    opacity: 0.5,
  },
  reserveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  backButton: {
    padding: 12,
    marginTop: 8,
  },
  backButtonText: {
    color: COLORS.orange,
    fontWeight: "700",
  },
});
