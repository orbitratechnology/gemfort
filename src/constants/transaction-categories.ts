import type { IconName } from '@/components/ui/icon';

export type CategoryMeta = { label: string; icon: IconName };

/**
 * Maps the gemtrack transaction category taxonomy (plan/06-firestore-schema.md)
 * to human labels and Material icons. Unknown categories fall back to a
 * title-cased label so the UI always reflects real data.
 */
const CATEGORY_META: Record<string, CategoryMeta> = {
  // Income
  sale: { label: 'Gem Sales', icon: 'diamond' },
  gem_sale: { label: 'Gem Sales', icon: 'diamond' },
  ap_income: { label: 'AP Income', icon: 'handshake' },
  commission_earned: { label: 'Commissions', icon: 'percent' },
  service_income: { label: 'Service Income', icon: 'build' },
  other_income: { label: 'Other Income', icon: 'add-circle' },

  // Expense
  general: { label: 'General', icon: 'receipt-long' },
  gem_purchase: { label: 'Sourcing', icon: 'shopping-bag' },
  cutting_fee: { label: 'Cutting', icon: 'content-cut' },
  heat_treatment_fee: { label: 'Treatment', icon: 'local-fire-department' },
  chemical_treatment_fee: { label: 'Treatment', icon: 'science' },
  polishing_fee: { label: 'Polishing', icon: 'auto-awesome' },
  lab_certification_fee: { label: 'Certification', icon: 'verified' },
  trip_expense: { label: 'Trips', icon: 'flight' },
  transport: { label: 'Transport', icon: 'local-shipping' },
  insurance: { label: 'Insurance', icon: 'shield' },
  commission_paid: { label: 'Commissions', icon: 'percent' },
  broker_fee: { label: 'Broker Fees', icon: 'percent' },
  rent: { label: 'Rent', icon: 'home' },
  salary: { label: 'Salary', icon: 'group' },
  marketing: { label: 'Marketing', icon: 'campaign' },
  equipment: { label: 'Equipment', icon: 'construction' },
  office: { label: 'Office', icon: 'business' },
  tax: { label: 'Tax', icon: 'account-balance' },
  other_expense: { label: 'Other', icon: 'more-horiz' },
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getCategoryMeta(category: string | null | undefined): CategoryMeta {
  if (!category) return { label: 'Other', icon: 'category' };
  return CATEGORY_META[category] ?? { label: titleCase(category), icon: 'category' };
}
