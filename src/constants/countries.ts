import {
  getAllCountries,
  getCountriesByName,
  getCountryByCca2,
  type ICountry,
  type ICountryCca2,
} from "rn-country-select";

/** Trade / travel defaults shown first in the country picker. */
export const POPULAR_COUNTRY_CODES: ICountryCca2[] = [
  "LK",
  "TH",
  "MM",
  "MG",
  "MZ",
  "TZ",
  "KE",
  "AE",
  "HK",
  "SG",
  "IN",
  "CN",
  "US",
  "GB",
  "AU",
  "BR",
  "CO",
];

export type AppCountry = {
  code: ICountryCca2;
  name: string;
  officialName: string;
  flag: string;
};

function toAppCountry(c: ICountry): AppCountry {
  return {
    code: c.cca2,
    name: c.name.common,
    officialName: c.name.official,
    flag: c.flag,
  };
}

/** Full ISO country catalog (offline, from rn-country-select). */
const ALL_COUNTRIES: AppCountry[] = getAllCountries()
  .map(toAppCountry)
  .sort((a, b) => a.name.localeCompare(b.name));

export function listCountries(): AppCountry[] {
  return ALL_COUNTRIES;
}

export function getCountryByCode(
  code: string | null | undefined,
): AppCountry | null {
  if (!code?.trim()) return null;
  const cca2 = code.trim().toUpperCase() as ICountryCca2;
  const hit = getCountryByCca2(cca2);
  return hit ? toAppCountry(hit) : null;
}

/** Resolve a stored label / ISO code to catalog entry. */
export function findCountry(
  value: string | null | undefined,
): AppCountry | null {
  if (!value?.trim()) return null;
  const raw = value.trim();

  const byCode = getCountryByCode(raw);
  if (byCode) return byCode;

  const byName = getCountriesByName(raw, "en");
  if (byName?.length) return toAppCountry(byName[0]!);

  const lower = raw.toLowerCase();
  return (
    ALL_COUNTRIES.find(
      (c) =>
        c.name.toLowerCase() === lower ||
        c.officialName.toLowerCase() === lower,
    ) ?? null
  );
}

/** ISO alpha-2 (lowercase) for flagcdn, or null. */
export function countryToFlagCode(
  value: string | null | undefined,
): string | null {
  return findCountry(value)?.code.toLowerCase() ?? null;
}
