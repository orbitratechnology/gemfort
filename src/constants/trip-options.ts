import type { IconName } from '@/components/ui/icon';
import type { TripStatus, TripType } from '@/types';

export const TRIP_TYPES: { id: TripType; label: string; subtitle: string; icon: IconName }[] = [
  { id: 'sourcing', label: 'Sourcing', subtitle: 'Buy rough at mines & markets', icon: 'explore' },
  { id: 'selling', label: 'Selling', subtitle: 'Take gems to buyers abroad', icon: 'flight-takeoff' },
  { id: 'both', label: 'Combined', subtitle: 'Source and sell on one trip', icon: 'sync-alt' },
];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'Planning',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TRIP_EXPENSE_CATEGORIES: { id: string; label: string; icon: IconName }[] = [
  { id: 'flight', label: 'Flight', icon: 'flight' },
  { id: 'accommodation', label: 'Stay', icon: 'hotel' },
  { id: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'transport', label: 'Transport', icon: 'directions-car' },
  { id: 'guide_fee', label: 'Guide', icon: 'person' },
  { id: 'mine_visit', label: 'Mine visit', icon: 'terrain' },
  { id: 'communication', label: 'Comms', icon: 'phone' },
  { id: 'shipping', label: 'Shipping', icon: 'local-shipping' },
  { id: 'exhibition', label: 'Exhibition', icon: 'storefront' },
  { id: 'entertainment', label: 'Entertainment', icon: 'celebration' },
  { id: 'equipment', label: 'Equipment', icon: 'build' },
  { id: 'other', label: 'Other', icon: 'more-horiz' },
];

export function getExpenseCategoryLabel(id: string): string {
  return TRIP_EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, ' ');
}

export function getExpenseCategoryIcon(id: string): IconName {
  return TRIP_EXPENSE_CATEGORIES.find((c) => c.id === id)?.icon ?? 'receipt';
}
