import * as Linking from "expo-linking";
import * as Location from "expo-location";

import type { ProfileLocation } from "@/types";

export const DEFAULT_PROFILE_REGION = {
  latitude: 6.4118,
  longitude: 80.0059,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

type Coordinates = Pick<ProfileLocation, "latitude" | "longitude">;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addressLabel(address: Location.LocationGeocodedAddress | undefined) {
  if (!address) return null;
  const parts = [
    address.name,
    address.street,
    address.city,
    address.district,
    address.region,
    address.country,
  ]
    .map(clean)
    .filter((value): value is string => !!value);
  return [...new Set(parts)].join(", ") || null;
}

export function profileLocationFromAddress(
  coordinates: Coordinates,
  address?: Location.LocationGeocodedAddress,
): ProfileLocation {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    label: addressLabel(address) ?? "Pinned location",
    city: clean(address?.city) ?? clean(address?.subregion),
    district: clean(address?.district) ?? clean(address?.subregion),
    country: clean(address?.country),
  };
}

export async function profileLocationFromCoordinates(
  coordinates: Coordinates,
): Promise<ProfileLocation> {
  try {
    const addresses = await Location.reverseGeocodeAsync(coordinates);
    return profileLocationFromAddress(coordinates, addresses[0]);
  } catch {
    return profileLocationFromAddress(coordinates);
  }
}

/** Requests only foreground access and returns a one-time location for the profile. */
export async function detectProfileLocation(): Promise<ProfileLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") return null;

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 10 * 60 * 1000,
    requiredAccuracy: 1000,
  });
  const current =
    lastKnown ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));

  return profileLocationFromCoordinates({
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
  });
}

export function profileLocationLabel(
  location: ProfileLocation | null | undefined,
  fallbackParts: (string | null | undefined)[] = [],
): string {
  return (
    location?.label?.trim() ||
    [...fallbackParts, location?.country]
      .map(clean)
      .filter((value): value is string => !!value)
      .join(", ") ||
    "Location"
  );
}

/** Opens the platform map app with a coordinate pin; web Maps is only a fallback. */
export async function openProfileLocation(
  location: ProfileLocation,
  fallbackQuery?: string,
): Promise<void> {
  const label = profileLocationLabel(location);
  const nativeUrl =
    process.env.EXPO_OS === "ios"
      ? `http://maps.apple.com/?ll=${location.latitude},${location.longitude}&q=${encodeURIComponent(label)}`
      : `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${encodeURIComponent(label)})`;

  try {
    await Linking.openURL(nativeUrl);
    return;
  } catch {
    const query = fallbackQuery?.trim() || `${location.latitude},${location.longitude}`;
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    );
  }
}
