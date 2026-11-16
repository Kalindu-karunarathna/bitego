
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Screen, Loading, Spacer } from "@/components/ui";

import {
  cancelBuyerReservation,
  getBuyerReservations,
  type Reservation,
} from "@/api/reservations";

import {
  createBuyerReview,
  getBuyerReviewedReservationIds,
} from "@/api/reviews";

const COLORS = {
  background: "#F3E9E0",
  card: "#FFFFFF",
  primary: "#D45100",
  primaryLight: "#FFF0E5",
  text: "#201A16",
  muted: "#8B8179",
  border: "#E9DED5",
  green: "#267A43",
  greenLight: "#FFF0CF",
  red: "#C43D32",
  blue: "#2865B0",
  star: "#E5A000",
};

const TABS = [
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "No-show", value: "NO_SHOW" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function formatPrice(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount === 0) {
    return "FREE";
  }

  return `Rs. ${amount.toFixed(2)}`;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleTimeString("en-LK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getPickupTime(reservation: Reservation) {
  return `${formatTime(reservation.listing.pickupStart)} – ${formatTime(
    reservation.listing.pickupEnd,
  )}`;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "READY FOR PICKUP";
    case "PICKED_UP":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    case "NO_SHOW":
      return "NO-SHOW";
    default:
      return status.replace(/_/g, " ");
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "CONFIRMED":
      return COLORS.green;
    case "PICKED_UP":
      return COLORS.blue;
    case "CANCELLED":
      return COLORS.red;
    default:
      return COLORS.muted;
  }
}

function getStatusBackground(status: string) {
  switch (status) {
    case "CONFIRMED":
      return COLORS.greenLight;
    case "PICKED_UP":
      return "#E8F0FF";
    case "CANCELLED":
      return "#FCEAE8";
    default:
      return "#F1ECE8";
  }
}

function belongsToTab(reservation: Reservation, tab: TabValue) {
  switch (tab) {
    case "UPCOMING":
      return reservation.status === "CONFIRMED";
    case "COMPLETED":
      return reservation.status === "PICKED_UP";
    case "CANCELLED":
      return reservation.status === "CANCELLED";
    case "NO_SHOW":
      return reservation.status === "NO_SHOW";
  }
}

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [reviewedReservationIds, setReviewedReservationIds] =
    useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<TabValue>("UPCOMING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Review state
  const [reviewReservation, setReviewReservation] =
    useState<Reservation | null>(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Load buyer reservations
  const loadReservations = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await getBuyerReservations();
      setReservations(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reservations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load reservation IDs that already have reviews
  const loadReviewedReservationIds = useCallback(async () => {
    try {
      const ids = await getBuyerReviewedReservationIds();

      console.log("[REVIEW API DEBUG]", {
        ids,
        isArray: Array.isArray(ids),
      });

      setReviewedReservationIds(ids);
    } catch (err) {
      console.warn(
        "Unable to load reviewed reservations:",
        err,
      );
    }
  }, []);

  // Load reservations and review status when screen opens
  useEffect(() => {
    void loadReservations();
    void loadReviewedReservationIds();
  }, [loadReservations, loadReviewedReservationIds]);

  const filteredReservations = useMemo(
    () => reservations.filter((item) => belongsToTab(item, activeTab)),
    [reservations, activeTab],
  );

  // Cancel reservation
  const confirmCancellation = async (reservation: Reservation) => {
    setCancellingId(reservation.id);
    setError(null);

    try {
      await cancelBuyerReservation(reservation.id);
      await loadReservations(false);

      Alert.alert(
        "Reservation cancelled",
        "Your reservation has been cancelled successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel this reservation.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  // Submit buyer review
  const handleSubmitReview = async () => {
    if (!reviewReservation || submittingReview) {
      return;
    }

    if (reviewComment.trim().length > 1000) {
      Alert.alert(
        "Comment too long",
        "Your review comment cannot exceed 1000 characters.",
      );
      return;
    }

    setSubmittingReview(true);

    try {
      const submittedReservationId = reviewReservation.id;

      await createBuyerReview({
        reservationId: submittedReservationId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });

      // Immediately mark this reservation as reviewed
      setReviewedReservationIds((previousIds) =>
        previousIds.includes(submittedReservationId)
          ? previousIds
          : [...previousIds, submittedReservationId],
      );

      Alert.alert(
        "Review submitted",
        "Thank you for sharing your experience!",
      );

      setReviewReservation(null);
      setReviewRating(5);
      setReviewComment("");
    } catch (err) {
      Alert.alert(
        "Unable to submit review",
        err instanceof Error
          ? err.message
          : "Please try again.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  // Show pickup details
  const handlePickupDetails = (reservation: Reservation) => {
    const listing = reservation.listing;
    const business = listing.business;

    const address = [
      business.addressLine,
      business.city,
      business.district,
    ]
      .filter(Boolean)
      .join(", ");

    const details = [
      `Food: ${listing.title}`,
      `Shop: ${business.name}`,
      `Pickup: ${getPickupTime(reservation)}`,
      `Date: ${formatDate(listing.pickupStart)}`,
      `Quantity: ${reservation.quantity} ${listing.unit}`,
      `Total: ${formatPrice(reservation.totalPrice)}`,
      "",
      `Pickup code: ${reservation.pickupCode}`,
      address ? `Location: ${address}` : "",
      business.contactNo ? `Contact: ${business.contactNo}` : "",
      listing.pickupNote ? `Note: ${listing.pickupNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const canCancel =
      reservation.status === "CONFIRMED" &&
      new Date(listing.pickupEnd).getTime() > Date.now();

    Alert.alert("Pickup details", details, [
      { text: "Close", style: "cancel" },
      ...(canCancel
        ? [
            {
              text: "Cancel reservation",
              style: "destructive" as const,
              onPress: () => {
                Alert.alert(
                  "Cancel reservation?",
                  "Are you sure you want to cancel this reservation?",
                  [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Confirm cancellation",
                      style: "destructive",
                      onPress: () => {
                        void confirmCancellation(reservation);
                      },
                    },
                  ],
                );
              },
            },
          ]
        : []),
    ]);
  };

  if (loading && reservations.length === 0) {
    return (
      <Screen centered>
        <Loading label="Loading your reservations..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My reservations</Text>
          <Text style={styles.subtitle}>
            Keep track of every reserved pickup.
          </Text>
        </View>

        <Spacer size={12} />

        {/* Status tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.value;

            return (
              <Pressable
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                style={[
                  styles.tab,
                  selected && styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    selected && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable onPress={() => void loadReservations()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Reservation cards */}
        {filteredReservations.length === 0 && !error ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {activeTab === "UPCOMING"
                ? "No upcoming reservations"
                : "No reservations found"}
            </Text>

            <Text style={styles.emptyDescription}>
              Your reservations will appear here when you reserve food.
            </Text>

            <Pressable
              onPress={() => void loadReservations()}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          filteredReservations.map((reservation) => {
            const listing = reservation.listing;

            const image =
              listing.images.find((item) => item.isPrimary) ??
              listing.images[0];

            const status = reservation.status;
            const isCancelling = cancellingId === reservation.id;

            const hasReviewed = reviewedReservationIds.includes(
              reservation.id,
            );

            console.log("[REVIEW DEBUG]", {
              reservationId: reservation.id,
              reservationStatus: reservation.status,
              reviewedReservationIds,
              hasReviewed,
            });

            return (
              <View key={reservation.id} style={styles.card}>
                {/* Food information */}
                <View style={styles.foodRow}>
                  {image?.imageUrl ? (
                    <Image
                      source={{ uri: image.imageUrl }}
                      style={styles.foodImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.foodImage,
                        styles.imagePlaceholder,
                      ]}
                    >
                      <Text style={styles.placeholderText}>Food</Text>
                    </View>
                  )}

                  <View style={styles.foodInfo}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusBackground(status),
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(status) },
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(status) },
                        ]}
                      >
                        {getStatusLabel(status)}
                      </Text>
                    </View>

                    <Text style={styles.foodTitle} numberOfLines={2}>
                      {listing.title}
                    </Text>

                    <Text style={styles.shopName} numberOfLines={1}>
                      {listing.business.name}
                    </Text>
                  </View>
                </View>

                {/* Reservation summary */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Quantity</Text>
                    <Text style={styles.summaryValue}>
                      {reservation.quantity}{" "}
                      {reservation.quantity === 1
                        ? listing.unit
                        : `${listing.unit}s`}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Price</Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        Number(reservation.totalPrice) === 0 &&
                          styles.freePrice,
                      ]}
                    >
                      {formatPrice(reservation.totalPrice)}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Pickup</Text>
                    <Text style={styles.summaryValue}>
                      {getPickupTime(reservation)}
                    </Text>
                  </View>
                </View>

                {/* Pickup details */}
                <Pressable
                  style={[
                    styles.detailsButton,
                    isCancelling && styles.disabledButton,
                  ]}
                  disabled={isCancelling}
                  onPress={() => handlePickupDetails(reservation)}
                >
                  <Text style={styles.detailsButtonText}>
                    {isCancelling
                      ? "Cancelling..."
                      : "Pickup details"}
                  </Text>
                </Pressable>

                {/* Review button: only for completed, unreviewed reservations */}
                {reservation.status === "PICKED_UP" && !hasReviewed ? (
                  <Pressable
                    style={styles.reviewButton}
                    onPress={() => {
                      setReviewReservation(reservation);
                      setReviewRating(5);
                      setReviewComment("");
                    }}
                  >
                    <Text style={styles.reviewButtonText}>
                      ★ Rate this food
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        {/* Review modal */}
        <Modal
          visible={reviewReservation !== null}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!submittingReview) {
              setReviewReservation(null);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.reviewModal}>
              <Text style={styles.modalTitle}>Rate your food</Text>

              {reviewReservation ? (
                <>
                  <Text style={styles.modalFoodTitle}>
                    {reviewReservation.listing.title}
                  </Text>

                  <Text style={styles.modalShopName}>
                    {reviewReservation.listing.business.name}
                  </Text>
                </>
              ) : null}

              <Text style={styles.ratingLabel}>
                How was your experience?
              </Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    disabled={submittingReview}
                    onPress={() => setReviewRating(star)}
                    style={styles.starButton}
                  >
                    <Text
                      style={[
                        styles.starText,
                        star <= reviewRating && styles.selectedStar,
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.ratingDescription}>
                {reviewRating} out of 5 stars
              </Text>

              <Text style={styles.commentLabel}>
                Comment (optional)
              </Text>

              <TextInput
                style={styles.commentInput}
                placeholder="Share your experience..."
                placeholderTextColor={COLORS.muted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                maxLength={1000}
                editable={!submittingReview}
                textAlignVertical="top"
              />

              <Text style={styles.characterCount}>
                {reviewComment.length}/1000
              </Text>

              <Pressable
                style={[
                  styles.submitReviewButton,
                  submittingReview && styles.disabledButton,
                ]}
                disabled={submittingReview}
                onPress={() => void handleSubmitReview()}
              >
                <Text style={styles.submitReviewText}>
                  {submittingReview
                    ? "Submitting..."
                    : "Submit review"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.closeModalButton}
                disabled={submittingReview}
                onPress={() => setReviewReservation(null)}
              >
                <Text style={styles.closeModalText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 20,
  },

  header: {
    marginTop: 3,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: COLORS.text,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
  },

  tabs: {
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 15,
  },

  tab: {
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  activeTab: {
    borderBottomColor: COLORS.primary,
  },

  tabText: {
    fontSize: 11,
    color: COLORS.text,
  },

  activeTabText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 19,
    padding: 11,
    marginBottom: 14,
    shadowColor: "#6C4B35",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  foodRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  foodImage: {
    width: 82,
    height: 82,
    borderRadius: 13,
    backgroundColor: COLORS.background,
  },

  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },

  placeholderText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  foodInfo: {
    flex: 1,
    marginLeft: 11,
    alignItems: "flex-start",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  statusText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  foodTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  shopName: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 3,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 21,
    marginBottom: 21,
  },

  summaryItem: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 5,
  },

  summaryValue: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text,
  },

  freePrice: {
    color: COLORS.primary,
  },

  detailsButton: {
    height: 43,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  detailsButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  reviewButton: {
    height: 43,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  reviewButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },

  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginTop: 5,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  emptyDescription: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },

  refreshButton: {
    marginTop: 15,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },

  refreshText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },

  errorBox: {
    backgroundColor: "#FCEAE8",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  errorText: {
    color: COLORS.red,
    fontSize: 12,
  },

  retryText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 7,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  reviewModal: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  modalFoodTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginTop: 13,
  },

  modalShopName: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
  },

  ratingLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginTop: 24,
  },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },

  starButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  starText: {
    fontSize: 39,
    color: COLORS.border,
  },

  selectedStar: {
    color: COLORS.star,
  },

  ratingDescription: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 5,
  },

  commentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 8,
  },

  commentInput: {
    minHeight: 95,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: "#FFFCFA",
  },

  characterCount: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: "right",
    marginTop: 5,
  },

  submitReviewButton: {
    height: 47,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 19,
  },

  submitReviewText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  closeModalButton: {
    alignItems: "center",
    paddingVertical: 13,
    marginTop: 4,
  },

  closeModalText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
  },
});
