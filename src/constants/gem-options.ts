import type { ImageSourcePropType } from 'react-native';

import type { IconName } from '@/components/ui/icon';
import type { GemStatus } from '@/types';

import {
  GEM_COLOR_FAMILIES,
  type GemColorFamily,
  type GemColorShade,
} from '@/constants/gem-colors';

export type { GemColorFamily, GemColorShade } from '@/constants/gem-colors';
export { GEM_COLOR_FAMILIES } from '@/constants/gem-colors';
export { GEM_CUTS } from '@/constants/gem-cuts';

/**
 * Gem types with local photos from GIA Gem Encyclopedia.
 * @see https://www.gia.edu/gem-encyclopedia
 */
export const GEM_TYPES = [
  {
    value: 'blue_sapphire',
    label: 'Blue Sapphire',
    icon: 'diamond' as IconName,
    image: require('@/assets/images/gems/blue-sapphire.png') as ImageSourcePropType,
  },
  {
    value: 'ruby',
    label: 'Ruby',
    icon: 'favorite' as IconName,
    image: require('@/assets/images/gems/ruby.png') as ImageSourcePropType,
  },
  {
    value: 'padparadscha',
    label: 'Padparadscha',
    icon: 'wb-sunny' as IconName,
    image: require('@/assets/images/gems/padparadscha.png') as ImageSourcePropType,
  },
  {
    value: 'emerald',
    label: 'Emerald',
    icon: 'eco' as IconName,
    image: require('@/assets/images/gems/emerald.png') as ImageSourcePropType,
  },
  {
    value: 'sapphire',
    label: 'Sapphire',
    icon: 'diamond' as IconName,
    image: require('@/assets/images/gems/sapphire.png') as ImageSourcePropType,
  },
  {
    value: 'star_sapphire',
    label: 'Star Sapphire',
    icon: 'star' as IconName,
    image: require('@/assets/images/gems/star-sapphire.png') as ImageSourcePropType,
  },
  {
    value: 'cat_eye',
    label: "Cat's Eye",
    icon: 'visibility' as IconName,
    image: require('@/assets/images/gems/cats-eye.png') as ImageSourcePropType,
  },
  {
    value: 'spinel',
    label: 'Spinel',
    icon: 'hexagon' as IconName,
    image: require('@/assets/images/gems/spinel.png') as ImageSourcePropType,
  },
  {
    value: 'garnet',
    label: 'Garnet',
    icon: 'brightness-1' as IconName,
    image: require('@/assets/images/gems/garnet.png') as ImageSourcePropType,
  },
  {
    value: 'tourmaline',
    label: 'Tourmaline',
    icon: 'water-drop' as IconName,
    image: require('@/assets/images/gems/tourmaline.png') as ImageSourcePropType,
  },
  {
    value: 'alexandrite',
    label: 'Alexandrite',
    icon: 'auto-awesome' as IconName,
    image: require('@/assets/images/gems/alexandrite.png') as ImageSourcePropType,
  },
  {
    value: 'amethyst',
    label: 'Amethyst',
    icon: 'spa' as IconName,
    image: require('@/assets/images/gems/amethyst.png') as ImageSourcePropType,
  },
  {
    value: 'ametrine',
    label: 'Ametrine',
    icon: 'auto-awesome' as IconName,
    image: require('@/assets/images/gems/ametrine.png') as ImageSourcePropType,
  },
  {
    value: 'aquamarine',
    label: 'Aquamarine',
    icon: 'water-drop' as IconName,
    image: require('@/assets/images/gems/aquamarine.png') as ImageSourcePropType,
  },
  {
    value: 'citrine',
    label: 'Citrine',
    icon: 'wb-sunny' as IconName,
    image: require('@/assets/images/gems/citrine.png') as ImageSourcePropType,
  },
  {
    value: 'diamond',
    label: 'Diamond',
    icon: 'diamond' as IconName,
    image: require('@/assets/images/gems/diamond.png') as ImageSourcePropType,
  },
  {
    value: 'fancy_color_diamond',
    label: 'Fancy Color Diamond',
    icon: 'auto-awesome' as IconName,
    image: require('@/assets/images/gems/fancy-color-diamond.png') as ImageSourcePropType,
  },
  {
    value: 'iolite',
    label: 'Iolite',
    icon: 'brightness-2' as IconName,
    image: require('@/assets/images/gems/iolite.png') as ImageSourcePropType,
  },
  {
    value: 'jade',
    label: 'Jade',
    icon: 'eco' as IconName,
    image: require('@/assets/images/gems/jade.png') as ImageSourcePropType,
  },
  {
    value: 'kunzite',
    label: 'Kunzite',
    icon: 'favorite' as IconName,
    image: require('@/assets/images/gems/kunzite.png') as ImageSourcePropType,
  },
  {
    value: 'lapis_lazuli',
    label: 'Lapis Lazuli',
    icon: 'palette' as IconName,
    image: require('@/assets/images/gems/lapis-lazuli.png') as ImageSourcePropType,
  },
  {
    value: 'moonstone',
    label: 'Moonstone',
    icon: 'brightness-3' as IconName,
    image: require('@/assets/images/gems/moonstone.png') as ImageSourcePropType,
  },
  {
    value: 'morganite',
    label: 'Morganite',
    icon: 'favorite' as IconName,
    image: require('@/assets/images/gems/morganite.png') as ImageSourcePropType,
  },
  {
    value: 'opal',
    label: 'Opal',
    icon: 'flare' as IconName,
    image: require('@/assets/images/gems/opal.png') as ImageSourcePropType,
  },
  {
    value: 'pearl',
    label: 'Pearl',
    icon: 'circle' as IconName,
    image: require('@/assets/images/gems/pearl.png') as ImageSourcePropType,
  },
  {
    value: 'peridot',
    label: 'Peridot',
    icon: 'eco' as IconName,
    image: require('@/assets/images/gems/peridot.png') as ImageSourcePropType,
  },
  {
    value: 'rose_quartz',
    label: 'Rose Quartz',
    icon: 'favorite' as IconName,
    image: require('@/assets/images/gems/rose-quartz.png') as ImageSourcePropType,
  },
  {
    value: 'sunstone',
    label: 'Sunstone',
    icon: 'wb-sunny' as IconName,
    image: require('@/assets/images/gems/sunstone.png') as ImageSourcePropType,
  },
  {
    value: 'tanzanite',
    label: 'Tanzanite',
    icon: 'diamond' as IconName,
    image: require('@/assets/images/gems/tanzanite.png') as ImageSourcePropType,
  },
  {
    value: 'topaz',
    label: 'Topaz',
    icon: 'hexagon' as IconName,
    image: require('@/assets/images/gems/topaz.png') as ImageSourcePropType,
  },
  {
    value: 'turquoise',
    label: 'Turquoise',
    icon: 'water-drop' as IconName,
    image: require('@/assets/images/gems/turquoise.png') as ImageSourcePropType,
  },
  {
    value: 'zircon',
    label: 'Zircon',
    icon: 'brightness-1' as IconName,
    image: require('@/assets/images/gems/zircon.png') as ImageSourcePropType,
  },
  {
    value: 'amber',
    label: 'Amber',
    icon: 'local-fire-department' as IconName,
    image: require('@/assets/images/gems/amber.png') as ImageSourcePropType,
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'more-horiz' as IconName,
    image: require('@/assets/images/gems/other.png') as ImageSourcePropType,
  },
] as const;

export type GemTypeValue = (typeof GEM_TYPES)[number]['value'];

export const GEM_CLARITIES = [
  { value: 'eye_clean', label: 'Eye Clean' },
  { value: 'slightly_included', label: 'Slightly Included' },
  { value: 'moderately_included', label: 'Moderately Included' },
  { value: 'heavily_included', label: 'Heavily Included' },
  { value: 'fl', label: 'FL (Flawless)' },
  { value: 'if', label: 'IF (Internally Flawless)' },
  { value: 'vvs', label: 'VVS' },
  { value: 'vs', label: 'VS' },
  { value: 'si', label: 'SI' },
  { value: 'i', label: 'I (Included)' },
  { value: 'opaque', label: 'Opaque' },
  { value: 'translucent', label: 'Translucent' },
] as const;

export const GEM_SHAPES = [
  { value: 'round', label: 'Round', icon: 'circle' as IconName },
  { value: 'oval', label: 'Oval', icon: 'crop-portrait' as IconName },
  { value: 'cushion', label: 'Cushion', icon: 'crop-square' as IconName },
  { value: 'emerald', label: 'Emerald', icon: 'crop-7-5' as IconName },
  { value: 'pear', label: 'Pear', icon: 'water-drop' as IconName },
  { value: 'marquise', label: 'Marquise', icon: 'toll' as IconName },
  { value: 'princess', label: 'Princess', icon: 'square' as IconName },
  { value: 'heart', label: 'Heart', icon: 'favorite' as IconName },
  { value: 'asscher', label: 'Asscher', icon: 'crop-square' as IconName },
  { value: 'radiant', label: 'Radiant', icon: 'auto-awesome' as IconName },
  { value: 'trillion', label: 'Trillion', icon: 'change-history' as IconName },
  { value: 'hexagon', label: 'Hexagon', icon: 'hexagon' as IconName },
  { value: 'octagon', label: 'Octagon', icon: 'pentagon' as IconName },
  { value: 'baguette', label: 'Baguette', icon: 'view-agenda' as IconName },
  { value: 'fancy', label: 'Fancy', icon: 'category' as IconName },
  { value: 'rough', label: 'Rough / Freeform', icon: 'grain' as IconName },
] as const;

/** ISO 3166-1 alpha-2 for flagcdn.com */
export type GemOrigin = {
  value: string;
  label: string;
  countryCode: string;
  note?: string;
};

export const GEM_ORIGINS: GemOrigin[] = [
  { value: 'sri_lanka', label: 'Sri Lanka', countryCode: 'lk', note: 'Ceylon sapphire, padparadscha' },
  { value: 'myanmar', label: 'Myanmar', countryCode: 'mm', note: 'Mogok ruby & sapphire' },
  { value: 'madagascar', label: 'Madagascar', countryCode: 'mg', note: 'Sapphire, ruby, tourmaline' },
  { value: 'mozambique', label: 'Mozambique', countryCode: 'mz', note: 'Montepuez ruby' },
  { value: 'thailand', label: 'Thailand', countryCode: 'th', note: 'Treatment & trading hub' },
  { value: 'cambodia', label: 'Cambodia', countryCode: 'kh', note: 'Pailin sapphire' },
  { value: 'tanzania', label: 'Tanzania', countryCode: 'tz', note: 'Winza, tanzanite, spinel' },
  { value: 'kenya', label: 'Kenya', countryCode: 'ke', note: 'Tsavorite, ruby' },
  { value: 'ethiopia', label: 'Ethiopia', countryCode: 'et', note: 'Opal, emerald' },
  { value: 'malawi', label: 'Malawi', countryCode: 'mw', note: 'Sapphire' },
  { value: 'nigeria', label: 'Nigeria', countryCode: 'ng', note: 'Tourmaline, sapphire' },
  { value: 'zambia', label: 'Zambia', countryCode: 'zm', note: 'Emerald' },
  { value: 'zimbabwe', label: 'Zimbabwe', countryCode: 'zw', note: 'Sandawana emerald' },
  { value: 'colombia', label: 'Colombia', countryCode: 'co', note: 'Emerald' },
  { value: 'brazil', label: 'Brazil', countryCode: 'br', note: 'Emerald, tourmaline, topaz' },
  { value: 'afghanistan', label: 'Afghanistan', countryCode: 'af', note: 'Panjshir emerald' },
  { value: 'pakistan', label: 'Pakistan', countryCode: 'pk', note: 'Swat emerald, peridot' },
  { value: 'india', label: 'India', countryCode: 'in', note: 'Kashmir sapphire (historic)' },
  { value: 'nepal', label: 'Nepal', countryCode: 'np', note: 'Tourmaline, aquamarine' },
  { value: 'vietnam', label: 'Vietnam', countryCode: 'vn', note: 'Ruby, sapphire' },
  { value: 'australia', label: 'Australia', countryCode: 'au', note: 'Sapphire, opal' },
  { value: 'china', label: 'China', countryCode: 'cn', note: 'Jade, sapphire' },
  { value: 'russia', label: 'Russia', countryCode: 'ru', note: 'Alexandrite, emerald' },
  { value: 'south_africa', label: 'South Africa', countryCode: 'za', note: 'Diamond, emerald' },
  { value: 'usa', label: 'United States', countryCode: 'us', note: 'Tourmaline, turquoise' },
  { value: 'canada', label: 'Canada', countryCode: 'ca', note: 'Diamond, sapphire' },
  { value: 'greenland', label: 'Greenland', countryCode: 'gl', note: 'Ruby' },
  { value: 'other', label: 'Other / Unknown', countryCode: 'un', note: 'Not listed' },
];

/** Untreated + distinct marketplace treatment categories. */
export const GEM_TREATMENTS = [
  { value: 'natural', label: 'Natural', icon: 'spa' as IconName },
  { value: 'chemical_diffusion', label: 'Chemical Diffusion', icon: 'science' as IconName },
  { value: 'coating', label: 'Coating', icon: 'layers' as IconName },
  { value: 'diffusion', label: 'Diffusion', icon: 'blur-on' as IconName },
  { value: 'doublet', label: 'Doublet', icon: 'filter-none' as IconName },
  { value: 'dyeing', label: 'Dyeing', icon: 'palette' as IconName },
  {
    value: 'glass_plastic_resin_impregnation',
    label: 'Glass/Plastic/Resin Impregnation',
    icon: 'opacity' as IconName,
  },
  {
    value: 'glass_plastic_resin_infilling',
    label: 'Glass/Plastic/Resin Infilling / Fracture Filling / Flux Healing',
    icon: 'healing' as IconName,
  },
  { value: 'heat_treatment', label: 'Heat Treatment', icon: 'local-fire-department' as IconName },
  { value: 'oiling_waxing', label: 'Oiling/Waxing', icon: 'water-drop' as IconName },
  { value: 'reconstitution', label: 'Reconstitution', icon: 'autorenew' as IconName },
  { value: 'smoke_diffusion', label: 'Smoke Diffusion', icon: 'cloud' as IconName },
] as const;

export type GemTreatmentValue = (typeof GEM_TREATMENTS)[number]['value'];

export const GEM_TREATMENT_VALUES = GEM_TREATMENTS.map((t) => t.value) as [
  GemTreatmentValue,
  ...GemTreatmentValue[],
];

export const GEM_STATUS_FILTERS: { value: GemStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rough', label: 'Rough' },
  { value: 'with_cutter', label: 'With Cutter' },
  { value: 'cut', label: 'Cut' },
  { value: 'ready_for_sale', label: 'Ready' },
  { value: 'on_ap', label: 'On AP' },
  { value: 'listed', label: 'Listed' },
  { value: 'sold', label: 'Sold' },
];

export const MANUAL_STATUS_OPTIONS: { value: GemStatus; label: string }[] = [
  { value: 'rough', label: 'Rough' },
  { value: 'with_cutter', label: 'With Cutter' },
  { value: 'cut', label: 'Cut' },
  { value: 'with_heater', label: 'With Heater' },
  { value: 'heated', label: 'Heated' },
  { value: 'with_polisher', label: 'With Polisher' },
  { value: 'polished', label: 'Polished' },
  { value: 'certified', label: 'Certified' },
  { value: 'ready_for_sale', label: 'Ready for Sale' },
  { value: 'on_ap', label: 'On AP' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'listed', label: 'Listed' },
  { value: 'sold', label: 'Sold' },
  { value: 'returned', label: 'Returned' },
];

export function formatGemType(value: string): string {
  return GEM_TYPES.find((t) => t.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function flagUrl(countryCode: string, size: 40 | 80 = 40): string {
  if (countryCode === 'un') {
    return `https://flagcdn.com/w${size}/un.png`;
  }
  return `https://flagcdn.com/w${size}/${countryCode}.png`;
}

/** Common aliases + non-origin countries that still appear as locations. */
const COUNTRY_ALIASES: Record<string, string> = {
  ceylon: 'lk',
  burma: 'mm',
  'united states of america': 'us',
  america: 'us',
  usa: 'us',
  uk: 'gb',
  britain: 'gb',
  'united kingdom': 'gb',
  england: 'gb',
  uae: 'ae',
  emirates: 'ae',
  'united arab emirates': 'ae',
  'hong kong': 'hk',
  singapore: 'sg',
  switzerland: 'ch',
  japan: 'jp',
  germany: 'de',
  france: 'fr',
  italy: 'it',
  belgium: 'be',
  israel: 'il',
  netherlands: 'nl',
  holland: 'nl',
  spain: 'es',
  portugal: 'pt',
  turkey: 'tr',
  'saudi arabia': 'sa',
  qatar: 'qa',
  bahrain: 'bh',
  kuwait: 'kw',
  malaysia: 'my',
  indonesia: 'id',
  philippines: 'ph',
  'south korea': 'kr',
  korea: 'kr',
  taiwan: 'tw',
  mexico: 'mx',
  argentina: 'ar',
  chile: 'cl',
  peru: 'pe',
  egypt: 'eg',
  morocco: 'ma',
  ghana: 'gh',
  botswana: 'bw',
  namibia: 'na',
  'new zealand': 'nz',
  austria: 'at',
  poland: 'pl',
  sweden: 'se',
  norway: 'no',
  denmark: 'dk',
  finland: 'fi',
  ireland: 'ie',
  scotland: 'gb',
  wales: 'gb',
};

/**
 * Resolve a slug, ISO code, display name, or free-text containing a country
 * to an ISO 3166-1 alpha-2 code for flagcdn. Returns null when unknown.
 */
export function resolveCountryCode(
  input: string | null | undefined,
): string | null {
  if (!input?.trim()) return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();
  const slug = lower.replace(/[\s-]+/g, '_');

  if (/^[a-z]{2}$/i.test(raw)) {
    return raw.toLowerCase() === 'un' ? 'un' : raw.toLowerCase();
  }

  const bySlug = GEM_ORIGINS.find((o) => o.value === slug || o.value === lower);
  if (bySlug && bySlug.value !== 'other') return bySlug.countryCode;

  const byLabel = GEM_ORIGINS.find((o) => o.label.toLowerCase() === lower);
  if (byLabel && byLabel.value !== 'other') return byLabel.countryCode;

  const byCode = GEM_ORIGINS.find((o) => o.countryCode === lower);
  if (byCode && byCode.value !== 'other') return byCode.countryCode;

  const alias = COUNTRY_ALIASES[lower] ?? COUNTRY_ALIASES[slug.replace(/_/g, ' ')];
  if (alias) return alias;

  // Free-text like "Ceylon, Sri Lanka" or "Mogok, Myanmar"
  const originsByLength = [...GEM_ORIGINS]
    .filter((o) => o.value !== 'other')
    .sort((a, b) => b.label.length - a.label.length);
  for (const o of originsByLength) {
    if (lower.includes(o.label.toLowerCase())) return o.countryCode;
  }

  const aliasesByLength = Object.entries(COUNTRY_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [name, code] of aliasesByLength) {
    if (name.length >= 4 && lower.includes(name)) return code;
  }

  return null;
}

export function findColorShade(shadeValue: string): {
  family: GemColorFamily;
  shade: GemColorShade;
} | null {
  for (const family of GEM_COLOR_FAMILIES) {
    const shade = family.shades.find((s) => s.value === shadeValue);
    if (shade) return { family, shade };
  }
  return null;
}

export function formatColorLabel(shadeValue: string | null | undefined): string {
  if (!shadeValue) return '';
  const hit = findColorShade(shadeValue);
  if (!hit) return shadeValue.replace(/_/g, ' ');
  return `${hit.family.label} · ${hit.shade.label}`;
}

export function formatOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function formatOriginLabel(value: string | null | undefined): string {
  if (!value) return '';
  return GEM_ORIGINS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}
