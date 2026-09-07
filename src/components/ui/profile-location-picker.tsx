import MapView, {
  Marker,
  UrlTile,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  DEFAULT_PROFILE_REGION,
  detectProfileLocation,
  profileLocationFromCoordinates,
  profileLocationLabel,
} from "@/lib/location/profile-location";
import type { ProfileLocation } from "@/types";
import { useAppTheme } from "@/hooks/use-app-theme";

type ProfileLocationPickerProps = {
  visible: boolean;
  value: ProfileLocation | null;
  onClose: () => void;
  onSave: (location: ProfileLocation) => void;
};

function regionFor(location: ProfileLocation | null): Region {
  return {
    latitude: location?.latitude ?? DEFAULT_PROFILE_REGION.latitude,
    longitude: location?.longitude ?? DEFAULT_PROFILE_REGION.longitude,
    latitudeDelta:
      location ? 0.025 : DEFAULT_PROFILE_REGION.latitudeDelta,
    longitudeDelta:
      location ? 0.025 : DEFAULT_PROFILE_REGION.longitudeDelta,
  };
}

export function ProfileLocationPicker({
  visible,
  value,
  onClose,
  onSave,
}: ProfileLocationPickerProps) {
  const { colors } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const selectionRef = useRef(0);
  const [draft, setDraft] = useState<ProfileLocation | null>(value);
  const [region, setRegion] = useState<Region>(() => regionFor(value));
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setRegion(regionFor(value));
    setError(null);
    setLocating(false);
    setResolving(false);
  }, [visible, value]);

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const next = await detectProfileLocation();
      if (!next) {
        setError("Location permission was not granted.");
        return;
      }
      const nextRegion = regionFor(next);
      setDraft(next);
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 400);
    } catch {
      setError("Could not detect your location. You can still tap the map.");
    } finally {
      setLocating(false);
    }
  }

  async function selectCoordinate(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
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
      title="Profile location"
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
          <View style={[styles.introIcon, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="location-on" size={20} color={colors.onPrimaryContainer} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.introTitle, { color: colors.onSurface }]}>Pin your business</Text>
            <Text style={[styles.introText, { color: colors.textMuted }]}>Tap the map or use your current location.</Text>
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
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            mapType="none"
            onPress={(event) => void selectCoordinate(event)}
            onRegionChangeComplete={setRegion}
            showsCompass
            showsScale
            showsUserLocation={false}
          >
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              tileSize={256}
              zIndex={1}
            />
            {draft ? (
              <Marker
                coordinate={{ latitude: draft.latitude, longitude: draft.longitude }}
                title="Profile location"
                description={profileLocationLabel(draft)}
              />
            ) : null}
          </MapView>
          <View pointerEvents="none" style={[styles.attribution, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.attributionText, { color: colors.textMuted }]}>© OpenStreetMap contributors</Text>
          </View>
        </View>

        <View style={styles.selectionRow}>
          <Icon name="place" size={18} color={colors.primary} />
          <Text style={[styles.selectionText, { color: colors.onSurface }]} numberOfLines={2}>
            {resolving ? "Finding the nearest address…" : draft ? profileLocationLabel(draft) : "Tap the map to choose a location"}
          </Text>
        </View>
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <Text style={[styles.note, { color: colors.textMuted }]}>Your exact pin is shared on your public profile.</Text>
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
  attribution: { position: "absolute", right: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  attributionText: { ...Typography.caption, fontSize: 9 },
  selectionRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  selectionText: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.caption },
  note: { ...Typography.caption },
});
