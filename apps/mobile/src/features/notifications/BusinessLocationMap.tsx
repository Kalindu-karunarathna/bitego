import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { validPickupCoordinates } from "./pickupRoute";
import { PickupDirectionsButton } from "./PickupDirectionsButton";
import { PickupMapStatus } from "./PickupMapStatus";
import { usePickupRoute } from "./usePickupRoute";

import type { BusinessLocationMapProps } from "./BusinessLocationMap.types";
export type { BusinessLocationMapProps } from "./BusinessLocationMap.types";

// Mount this component inside the selected reservation's pickup details.
export function BusinessLocationMap({
  name, address, height = 240, interactive = false, showDirections = true, ...options
}: BusinessLocationMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const state = usePickupRoute(options);
  const { latitude, longitude } = state.route?.destination ?? options;
  const validShop = validPickupCoordinates({ latitude, longitude });

  useEffect(() => {
    if (!ready || !laidOut || !validShop) return;
    const points = [
      { latitude, longitude },
      ...(state.origin ? [state.origin] : []),
      ...(state.route?.coordinates ?? []),
    ];
    map.current?.fitToCoordinates(points, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [latitude, longitude, validShop, state.origin, state.route, ready, laidOut]);

  return (
    <View style={styles.container}>
      <View style={[styles.map, { height }]}>
        {validShop ? (
          <MapView provider={PROVIDER_GOOGLE} ref={map} style={StyleSheet.absoluteFill}
            initialRegion={{ latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
            onMapReady={() => setReady(true)} onLayout={() => setLaidOut(true)}
            scrollEnabled={interactive} zoomEnabled={interactive}
            rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
            <Marker coordinate={{ latitude, longitude }} title={name}
              description={address ?? "Pickup shop"} pinColor="#E65100" />
            {state.origin ? <Marker coordinate={state.origin} title="Your location" pinColor="#1976D2" /> : null}
            {state.route ? <Polyline coordinates={state.route.coordinates} strokeColor="#E65100" strokeWidth={5} /> : null}
          </MapView>
        ) : <Text style={styles.unavailable}>The shop location is unavailable.</Text>}
      </View>
      <PickupMapStatus name={name} address={address} status={state.status}
        route={state.route} message={state.message} onRetry={state.retry} />
      {showDirections ? <PickupDirectionsButton key={state.key} reservationId={options.reservationId}
        latitude={latitude} longitude={longitude} userLatitude={state.origin?.latitude}
        userLongitude={state.origin?.longitude} style={styles.directions} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBE3D5", marginVertical: 10 },
  map: { width: "100%", backgroundColor: "#EDE8DD", justifyContent: "center", alignItems: "center" },
  directions: { marginHorizontal: 14, marginBottom: 14 },
  unavailable: { padding: 20, color: "#795548" },
});
