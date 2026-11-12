import type { PickupRouteOptions } from "./usePickupRoute";

export type BusinessLocationMapProps = PickupRouteOptions & {
  name: string;
  address?: string;
  height?: number;
  interactive?: boolean;
};
