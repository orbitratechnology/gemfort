import {
  Camera,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  DEFAULT_PROFILE_REGION,
  detectProfileLocation,
  profileLocationFromCoordinates,
  profileLocationLabel,
} from "@/lib/location/profile-location";
import type { ProfileLocation } from "@/types";

type ProfileLocationPickerProps = {
  visible: boolean;
  value: ProfileLocation | null;
  onClose: () => void;
  onSave: (location: ProfileLocation) => void;
};

type ProfileRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const OSM_ZOOM_MIN = 3;
const OSM_ZOOM_MAX = 19;
const OSM_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.de/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap",
    },
  ],
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function zoomForRegion(region: ProfileRegion) {
  return clamp(
    Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 0.001))),
    OSM_ZOOM_MIN,
    OSM_ZOOM_MAX,
  );
}

function regionFor(location: ProfileLocation | null): ProfileRegion {
  return {
    latitude: location?.latitude ?? DEFAULT_PROFILE_REGION.latitude,
    longitude: location?.longitude ?? DEFAULT_PROFILE_REGION.longitude,
    latitudeDelta: location ? 0.025 : DEFAULT_PROFILE_REGION.latitudeDelta,
    longitudeDelta: location ? 0.025 : DEFAULT_PROFILE_REGION.longitudeDelta,
  };
}

export function ProfileLocationPicker({
  visible,
  value,
  onClose,
  onSave,
}: ProfileLocationPickerProps) {
  const { colors } = useAppTheme();
  const cameraRef = useRef<CameraRef>(null);
  const selectionRef = useRef(0);
  const [draft, setDraft] = useState<ProfileLocation | null>(value);
  const [region, setRegion] = useState<ProfileRegion>(() => regionFor(value));
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRevision, setMapRevision] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setRegion(regionFor(value));
    setError(null);
    setLocating(false);
    setResolving(false);
    setMapLoading(false);
    setMapError(null);
  }, [visible, value]);

  useEffect(() => {
    if (!visible) return;
    cameraRef.current?.jumpTo({
      center: [region.longitude, region.latitude],
      zoom: zoomForRegion(region),
    });
  }, [visible, region.latitude, region.longitude, region.longitudeDelta]);

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const next = await detectProfileLocation();
      if (!next) {
        setError("Location permission was not granted.");
        return;
      }
      setDraft(next);
      setRegion(regionFor(next));
    } catch {
      setError("Could not detect your location. You can still tap the map.");
    } finally {
      setLocating(false);
    }
  }

  async function selectCoordinate(
    coordinates: Pick<ProfileLocation, "latitude" | "longitude">,
  ) {
    const { latitude, longitude } = coordinates;
    const selectionId = selectionRef.current + 1;
    selectionRef.current = selectionId;
    setResolving(true);
    setError(null);
    setDraft({ latitude, longitude, label: "Pinned location" });
    try {
      const next = await profileLocationFromCoordinates({ latitude, longitude });
      if (selectionRef.current === selectionId) setDraft(next);
    } finally {
      if (selectionRef.current === selectionId) setResolving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Location"
      scrollable={false}
      footer={
        <Button
          title="Save location"
          icon="check"
          disabled={!draft || locating || resolving}
          onPress={() => {
            if (draft) onSave(draft);
          }}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.introRow}>
          <View
            style={[styles.introIcon, { backgroundColor: colors.primaryContainer }]}
          >
            <Icon name="location-on" size={20} color={colors.onPrimaryContainer} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.introTitle, { color: colors.onSurface }]}>Pin your business</Text>
            <Text style={[styles.introText, { color: colors.textMuted }]}>Drag to move, pinch to zoom, or tap to pin.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            disabled={locating}
            onPress={() => void useCurrentLocation()}
            style={({ pressed }) => [
              styles.locateButton,
              { borderColor: colors.outlineVariant, opacity: pressed || locating ? 0.65 : 1 },
            ]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="my-location" size={20} color={colors.primary} />
            )}
          </Pressable>
        </View>

        <View style={[styles.mapFrame, { borderColor: colors.outlineVariant }]}>
          <MapLibreMap
            key={mapRevision}
            testID="profile-location-map"
            style={styles.map}
            mapStyle={OSM_MAP_STYLE}
            dragPan
            touchZoom
            doubleTapZoom
            touchRotate={false}
            touchPitch={false}
            attribution={false}
            logo={false}
            scaleBar
            onWillStartLoadingMap={() => {
              setMapLoading(true);
              setMapError(null);
            }}
            onDidFinishLoadingMap={() => {
              setMapLoading(false);
              setMapError(null);
            }}
            onDidFailLoadingMap={() => {
              setMapLoading(false);
              setMapError("Map could not load. Check your connection and try again.");
            }}
            onPress={(event) => {
              const [longitude, latitude] = event.nativeEvent.lngLat;
              void selectCoordinate({ latitude, longitude });
            }}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: [region.longitude, region.latitude],
                zoom: zoomForRegion(region),
              }}
              minZoom={OSM_ZOOM_MIN}
              maxZoom={OSM_ZOOM_MAX}
            />
            {draft ? (
              <Marker
                id="profile-location-marker"
                lngLat={[draft.longitude, draft.latitude]}
                anchor="bottom"
              >
                <View style={styles.marker}>
                  <Icon name="location-on" size={32} color="#d32f2f" />
                </View>
              </Marker>
            ) : null}
          </MapLibreMap>
          {mapLoading ? (
            <View
              pointerEvents="none"
              style={[styles.mapStatus, { backgroundColor: colors.surfaceContainerLowest }]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.mapStatusText, { color: colors.onSurface }]}>Loading map…</Text>
            </View>
          ) : null}
          {mapError ? (
            <View
              style={[styles.mapError, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.error }]}
            >
              <Text style={[styles.mapErrorText, { color: colors.onSurface }]}>{mapError}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading map"
                onPress={() => {
                  setMapError(null);
                  setMapLoading(true);
                  setMapRevision((current) => current + 1);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.selectionRow}>
          <Icon name="place" size={18} color={colors.primary} />
          <Text style={[styles.selectionText, { color: colors.onSurface }]} numberOfLines={2}>
            {resolving
              ? "Finding the nearest address…"
              : draft
                ? profileLocationLabel(draft)
                : "Tap the map to choose a location"}
          </Text>
        </View>
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, gap: Spacing.md },
  introRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  introIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  introCopy: { flex: 1, gap: 2 },
  introTitle: { ...Typography.labelMd, fontWeight: "600" },
  introText: { ...Typography.caption },
  locateButton: { width: 42, height: 42, borderRadius: Radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mapFrame: { flex: 1, minHeight: 250, overflow: "hidden", borderWidth: 1, borderRadius: Radius.xl },
  map: { flex: 1 },
  marker: { width: 36, height: 36, alignItems: "center", justifyContent: "flex-end" },
  mapStatus: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: Spacing.xs },
  mapStatusText: { ...Typography.caption },
  mapError: { position: "absolute", left: Spacing.md, right: Spacing.md, top: Spacing.md, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md, gap: Spacing.sm },
  mapErrorText: { ...Typography.caption },
  retryText: { ...Typography.labelMd, fontWeight: "600" },
  selectionRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  selectionText: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.caption },
  note: { ...Typography.caption },
});
