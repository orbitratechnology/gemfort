import { City } from "country-state-city";

import { findCountry } from "@/constants/countries";

export type AppCity = {
  name: string;
  countryCode: string;
  stateCode: string;
  latitude?: string | null;
  longitude?: string | null;
};

/** Gem-trade hubs pinned to the top of the city list when present. */
const POPULAR_CITY_NAMES: Record<string, string[]> = {
  LK: [
    "Ratnapura",
    "Beruwala",
    "Colombo",
    "Kandy",
    "Galle",
    "Negombo",
    "Matara",
  ],
  TH: ["Bangkok", "Chanthaburi", "Trat", "Mae Sot"],
  MM: ["Mogok", "Mandalay", "Yangon", "Myitkyina"],
  MG: ["Antananarivo", "Ilakaka", "Toamasina"],
  MZ: ["Maputo", "Montepuez", "Nampula"],
  TZ: ["Arusha", "Dar es Salaam", "Merelani"],
  KE: ["Nairobi", "Voi", "Mombasa"],
  IN: ["Jaipur", "Mumbai", "Surat", "Chennai"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  HK: ["Hong Kong"],
  SG: ["Singapore"],
  CN: ["Guangzhou", "Shenzhen", "Beijing", "Shanghai"],
  BR: ["São Paulo", "Rio de Janeiro", "Teófilo Otoni"],
  CO: ["Bogotá", "Medellín", "Muzo"],
  US: ["New York", "Los Angeles", "Chicago", "Houston"],
  GB: ["London", "Birmingham", "Manchester"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
};

function toAppCity(c: {
  name: string;
  countryCode: string;
  stateCode: string;
  latitude?: string | null;
  longitude?: string | null;
}): AppCity {
  return {
    name: c.name,
    countryCode: c.countryCode,
    stateCode: c.stateCode,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

/** Resolve country name / ISO → uppercase ISO2 for city lookups. */
export function resolveCountryIso2(
  country: string | null | undefined,
): string | null {
  const hit = findCountry(country);
  return hit?.code ?? null;
}

/**
 * Cities for a country (name or ISO2). Deduped by name, popular hubs first.
 */
export function listCitiesForCountry(
  country: string | null | undefined,
): AppCity[] {
  const iso2 = resolveCountryIso2(country);
  if (!iso2) return [];

  const raw = City.getCitiesOfCountry(iso2) ?? [];
  const byName = new Map<string, AppCity>();
  for (const c of raw) {
    const key = c.name.trim().toLowerCase();
    if (!key || byName.has(key)) continue;
    byName.set(key, toAppCity(c));
  }

  const cities = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const popularNames = POPULAR_CITY_NAMES[iso2] ?? [];
  if (popularNames.length === 0) return cities;

  const popular: AppCity[] = [];
  const popularKeys = new Set<string>();
  for (const name of popularNames) {
    const hit = byName.get(name.toLowerCase());
    if (hit) {
      popular.push(hit);
      popularKeys.add(hit.name.toLowerCase());
    }
  }

  const rest = cities.filter((c) => !popularKeys.has(c.name.toLowerCase()));
  return [...popular, ...rest];
}

export function cityBelongsToCountry(
  cityName: string | null | undefined,
  country: string | null | undefined,
): boolean {
  if (!cityName?.trim() || !country?.trim()) return false;
  const cities = listCitiesForCountry(country);
  const lower = cityName.trim().toLowerCase();
  return cities.some((c) => c.name.toLowerCase() === lower);
}
