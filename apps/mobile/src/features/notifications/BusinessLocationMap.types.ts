import type { PickupRouteOptions } from "./usePickupRoute";

export type BusinessLocationMapProps = PickupRouteOptions & {
  name: string;
  address?: string;
  height?: number;
  interactive?: boolean;
  /** Set false when placing PickupDirectionsButton in the screen footer. */
  showDirections?: boolean;
};
