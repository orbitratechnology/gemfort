import type { GemStatus } from '@/types';

export const GEM_TYPES = [
  { value: 'blue_sapphire', label: 'Blue Sapphire' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'padparadscha', label: 'Padparadscha' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'cat_eye', label: 'Cat\'s Eye' },
  { value: 'star_sapphire', label: 'Star Sapphire' },
  { value: 'spinel', label: 'Spinel' },
  { value: 'garnet', label: 'Garnet' },
  { value: 'tourmaline', label: 'Tourmaline' },
  { value: 'other', label: 'Other' },
] as const;

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
