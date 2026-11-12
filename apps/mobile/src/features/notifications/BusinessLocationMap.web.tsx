import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { BusinessLocationMapProps } from "./BusinessLocationMap.types";
import { PickupMapStatus } from "./PickupMapStatus";
import { createPickupMapDocument } from "./pickupMapDocument";
import { validPickupCoordinates } from "./pickupRoute";
import { usePickupRoute } from "./usePickupRoute";
export type { BusinessLocationMapProps } from "./BusinessLocationMap.types";

// Only a browser-restricted Maps JavaScript key belongs in this public variable.
// The Google Routes server key must never be passed to the app or this iframe.
export function BusinessLocationMap(props: BusinessLocationMapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY?.trim();
  if (!apiKey) return (
    <View style={styles.container}>
      <Text style={styles.unavailable}>The pickup map is temporarily unavailable.</Text>
    </View>
  );
  return <ConfiguredPickupMap {...props} apiKey={apiKey} />;
}

function ConfiguredPickupMap({
  apiKey, name, address, height = 240, interactive = false, ...options
}: BusinessLocationMapProps & { apiKey: string }) {
  const state = usePickupRoute(options);
  const frame = useRef<HTMLIFrameElement>(null);
  const { latitude, longitude } = state.route?.destination ?? options;
  const validShop = validPickupCoordinates({ latitude, longitude });
  const mapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID?.trim() || "DEMO_MAP_ID";
  const source = useMemo(() => validShop ? createPickupMapDocument({
    apiKey, mapId, destination: { latitude: options.latitude, longitude: options.longitude }, origin: null,
    coordinates: [], name, interactive,
  }) : "", [apiKey, mapId, options.latitude, options.longitude, name, interactive, validShop]);

  const updateMap = useCallback(() => {
    frame.current?.contentWindow?.postMessage({
      type: "bitego-pickup-map", payload: {
        destination: { latitude, longitude }, origin: state.origin,
        coordinates: state.route?.coordinates ?? [],
      },
    }, window.location.origin);
  }, [latitude, longitude, state.origin, state.route]);
  useEffect(updateMap, [updateMap]);

  return (
    <View style={styles.container}>
      <View style={[styles.map, { height }]}>
        {validShop ? <iframe ref={frame} onLoad={updateMap} title={name + " pickup route"} srcDoc={source}
          // Reload an errored map when the user explicitly retries the route.
          key={state.key} sandbox="allow-scripts allow-same-origin"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ width: "100%", height: "100%", border: "none" }} />
          : <Text style={styles.unavailable}>The shop location is unavailable.</Text>}
      </View>
      <PickupMapStatus name={name} address={address} status={state.status}
        route={state.route} message={state.message} onRetry={state.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBE3D5", marginVertical: 10 },
  map: { width: "100%", backgroundColor: "#EDE8DD", justifyContent: "center", alignItems: "center" },
  unavailable: { padding: 20, color: "#795548" },
});
