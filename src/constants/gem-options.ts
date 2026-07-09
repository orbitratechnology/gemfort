import type { IconName } from '@/components/ui/icon';
import type { GemStatus } from '@/types';

export const GEM_TYPES = [
  { value: 'blue_sapphire', label: 'Blue Sapphire', icon: 'diamond' as IconName },
  { value: 'ruby', label: 'Ruby', icon: 'favorite' as IconName },
  { value: 'padparadscha', label: 'Padparadscha', icon: 'wb-sunny' as IconName },
  { value: 'emerald', label: 'Emerald', icon: 'eco' as IconName },
  { value: 'cat_eye', label: "Cat's Eye", icon: 'visibility' as IconName },
  { value: 'star_sapphire', label: 'Star Sapphire', icon: 'star' as IconName },
  { value: 'spinel', label: 'Spinel', icon: 'hexagon' as IconName },
  { value: 'garnet', label: 'Garnet', icon: 'brightness-1' as IconName },
  { value: 'tourmaline', label: 'Tourmaline', icon: 'water-drop' as IconName },
  { value: 'other', label: 'Other', icon: 'more-horiz' as IconName },
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
