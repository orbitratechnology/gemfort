import type { IconName } from '@/components/ui/icon';
import type { TripStatus, TripType } from '@/types';

export const TRIP_TYPES: { id: TripType; label: string; subtitle: string; icon: IconName }[] = [
  { id: 'sourcing', label: 'Sourcing', subtitle: 'Buy rough at mines & markets', icon: 'explore' },
  { id: 'selling', label: 'Selling', subtitle: 'Take gems to buyers abroad', icon: 'flight-takeoff' },
  {
    id: 'both',
    label: 'Source & Sell',
    subtitle: 'Source and sell on one trip',
    icon: 'sync-alt',
  },
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

export const TRIP_PAYMENT_METHODS: {
  id: 'cash' | 'card' | 'transfer';
  label: string;
  icon: IconName;
}[] = [
  { id: 'cash', label: 'Cash', icon: 'payments' },
  { id: 'card', label: 'Card', icon: 'credit-card' },
  { id: 'transfer', label: 'Transfer', icon: 'account-balance' },
];

export type TripPaymentMethod = (typeof TRIP_PAYMENT_METHODS)[number]['id'];

export function getTripPaymentMethodLabel(id: string | null | undefined): string {
  if (!id) return '';
  const match = TRIP_PAYMENT_METHODS.find((m) => m.id === id);
  if (match) return match.label;
  // Legacy free-text values (e.g. "Cash")
  return id.charAt(0).toUpperCase() + id.slice(1);
}
