import { apiFetch } from "@/api/client";

export type Reservation = {
  id: string;
  listingId: string;
  buyerId: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status: string;
  pickupCode: string;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;

  listing: {
    id: string;
    title: string;
    description: string | null;
    unit: string;
    pickupStart: string;
    pickupEnd: string;
    pickupNote: string | null;

    category: {
      id: string;
      name: string;
    };

    business: {
      id: string;
      name: string;
      addressLine: string;
      city: string;
      district: string;
      contactNo: string | null;
    };

    images: {
      id: string;
      imageUrl: string;
      isPrimary: boolean;
    }[];
  };
};

export async function getBuyerReservations(): Promise<Reservation[]> {
  return apiFetch<Reservation[]>("/reservations");
}

export async function cancelBuyerReservation(
  reservationId: string,
  reason?: string,
): Promise<Reservation> {
  return apiFetch<Reservation>(
    `/reservations/${encodeURIComponent(reservationId)}`,
    {
      method: "PATCH",
      body: reason ? { reason } : {},
    },
  );
}