import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';

import { BASE_CURRENCY } from '@/constants/currencies';
import { isPendingCheque, toDate } from '@/features/workspace/cheque-utils';
import { resolveGemLifecycle, resolveGemSaleStatus } from '@/features/workspace/gem-lifecycle';
import type { DateRange } from '@/features/workspace/money-utils';
import type { Cheque, WorkspaceGem } from '@/types';

/**
 * Gem-trade views of the workspace for the Money tab: what the stones sold
 * for against what they cost, where the capital in stock is sitting, and
 * which cheques clear soon. Every amount is LKR base.
 */

/** A stone's full cost (purchase + cutting, heating, polishing…) in LKR. */
export function gemCostBase(gem: WorkspaceGem): number {
  const total = gem.totalCost ?? 0;
  const currency = gem.totalCostCurrency || BASE_CURRENCY;
  if (currency === BASE_CURRENCY) return total;
  // Costs are booked in the purchase currency; reuse its locked-in rate.
  if (currency === gem.acquisitionCurrency && gem.acquisitionCost > 0) {
    return total * (gem.acquisitionCostBase / gem.acquisitionCost);
  }
  return gem.acquisitionCostBase ?? 0;
}

/** Sale price in LKR, or null when it was never converted. */
export function gemSaleBase(gem: WorkspaceGem): number | null {
  if (typeof gem.soldPriceBase === 'number') return gem.soldPriceBase;
  const price = gem.soldPrice ?? gem.lastSoldPrice ?? null;
  const currency = gem.soldPriceCurrency ?? gem.lastSoldPriceCurrency ?? BASE_CURRENCY;
  return price != null && currency === BASE_CURRENCY ? price : null;
}

export function gemLabel(gem: WorkspaceGem): string {
  return gem.title?.trim() || gem.sku || 'Stone';
}

function isSold(gem: WorkspaceGem) {
  return resolveGemSaleStatus(gem) === 'sold';
}

// ─── Stones sold ──────────────────────────────────────

export type SoldStone = {
  id: string;
  label: string;
  gemType: string;
  weight: number;
  soldDate: Date;
  buyer: string | null;
  revenue: number;
  cost: number;
  profit: number;
  /** Profit as a share of the sale price; null without a sale price. */
  marginPct: number | null;
  /** Days from purchase to sale. */
  daysHeld: number | null;
};

export type StoneSales = {
  stones: SoldStone[];
  count: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  avgDaysHeld: number | null;
};

/** Stones sold within `range`, newest first, with margin on each. */
export function getStoneSales(gems: WorkspaceGem[], range: DateRange): StoneSales {
  const stones: SoldStone[] = [];
  for (const gem of gems) {
    if (!isSold(gem)) continue;
    const soldDate = toDate(gem.soldDate);
    if (!soldDate || soldDate < range.start || soldDate > range.end) continue;
    const revenue = gemSaleBase(gem) ?? 0;
    const cost = gemCostBase(gem);
    const bought = toDate(gem.acquisitionDate);
    stones.push({
      id: gem.id,
      label: gemLabel(gem),
      gemType: gem.gemType,
      weight: gem.currentWeight,
      soldDate,
      buyer: gem.soldToBusinessName || gem.soldToName || null,
      revenue,
      cost,
      profit: revenue - cost,
      marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
      daysHeld: bought ? Math.max(0, differenceInCalendarDays(soldDate, bought)) : null,
    });
  }
  stones.sort((a, b) => b.soldDate.getTime() - a.soldDate.getTime());

  const revenue = stones.reduce((s, x) => s + x.revenue, 0);
  const cost = stones.reduce((s, x) => s + x.cost, 0);
  const held = stones.filter((x) => x.daysHeld != null);
  return {
    stones,
    count: stones.length,
    revenue,
    cost,
    profit: revenue - cost,
    marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
    avgDaysHeld: held.length
      ? Math.round(held.reduce((s, x) => s + (x.daysHeld ?? 0), 0) / held.length)
      : null,
  };
}

// ─── Stock position ───────────────────────────────────

export type StockPlace = 'in_hand' | 'lapidary' | 'on_ap' | 'on_trip' | 'listed' | 'sale_pending';

export const STOCK_PLACES: { key: StockPlace; label: string }[] = [
  { key: 'in_hand', label: 'In hand' },
  { key: 'listed', label: 'Listed for sale' },
  { key: 'lapidary', label: 'At cutter / heater' },
  { key: 'on_ap', label: 'Out on AP' },
  { key: 'on_trip', label: 'On a trip' },
  { key: 'sale_pending', label: 'Sale pending' },
];

/** Stones held this long without selling count as slow movers. */
export const SLOW_MOVER_DAYS = 180;

export type StockPosition = {
  count: number;
  cost: number;
  /** Asking prices of stones that have one. */
  askingTotal: number;
  /** Cost of the same priced stones, so the markup compares like with like. */
  pricedCost: number;
  pricedCount: number;
  places: { key: StockPlace; label: string; count: number; cost: number }[];
  slowMovers: { count: number; cost: number };
  oldest: { id: string; label: string; days: number; cost: number }[];
};

export function stockPlaceOf(gem: WorkspaceGem): StockPlace {
  if (resolveGemSaleStatus(gem) === 'pending') return 'sale_pending';
  const { custody, outcome } = resolveGemLifecycle(gem);
  if (custody === 'on_ap') return 'on_ap';
  if (custody === 'on_trip') return 'on_trip';
  if (custody === 'with_cutter' || custody === 'with_heater' || custody === 'with_polisher') {
    return 'lapidary';
  }
  if (outcome === 'listed') return 'listed';
  return 'in_hand';
}

/** Unsold stones and where their cost is sitting right now. */
export function getStockPosition(gems: WorkspaceGem[], now = new Date()): StockPosition {
  const totals = new Map<StockPlace, { count: number; cost: number }>();
  let count = 0;
  let cost = 0;
  let askingTotal = 0;
  let pricedCost = 0;
  let pricedCount = 0;
  const aged: StockPosition['oldest'] = [];

  for (const gem of gems) {
    if (gem.archiveSnapshot || isSold(gem)) continue;
    if (resolveGemLifecycle(gem).outcome === 'returned') continue;
    const gemCost = gemCostBase(gem);
    count += 1;
    cost += gemCost;
    const place = stockPlaceOf(gem);
    const bucket = totals.get(place) ?? { count: 0, cost: 0 };
    bucket.count += 1;
    bucket.cost += gemCost;
    totals.set(place, bucket);

    const asking =
      typeof gem.askingPriceBase === 'number'
        ? gem.askingPriceBase
        : gem.askingPrice != null && (gem.askingPriceCurrency ?? BASE_CURRENCY) === BASE_CURRENCY
          ? gem.askingPrice
          : null;
    if (asking != null && asking > 0) {
      askingTotal += asking;
      pricedCost += gemCost;
      pricedCount += 1;
    }

    const bought = toDate(gem.acquisitionDate);
    if (bought) {
      const days = differenceInCalendarDays(now, bought);
      if (days >= SLOW_MOVER_DAYS) aged.push({ id: gem.id, label: gemLabel(gem), days, cost: gemCost });
    }
  }

  aged.sort((a, b) => b.days - a.days);
  return {
    count,
    cost,
    askingTotal,
    pricedCost,
    pricedCount,
    places: STOCK_PLACES.map((p) => ({ ...p, ...(totals.get(p.key) ?? { count: 0, cost: 0 }) })),
    slowMovers: { count: aged.length, cost: aged.reduce((s, x) => s + x.cost, 0) },
    oldest: aged.slice(0, 5),
  };
}

// ─── Cheques clearing soon ────────────────────────────

export type ChequeOutlook = {
  /** Received cheques still to bank, due within the window (or already due). */
  incoming: { amount: number; count: number };
  /** Cheques you issued that will be presented within the window. */
  outgoing: { amount: number; count: number };
  /** Received cheques past their date and still not deposited. */
  readyToDeposit: number;
  upcoming: Cheque[];
};

export function getChequeOutlook(cheques: Cheque[], days = 30, now = new Date()): ChequeOutlook {
  const today = startOfDay(now);
  const until = addDays(today, days);
  const upcoming: Cheque[] = [];
  const incoming = { amount: 0, count: 0 };
  const outgoing = { amount: 0, count: 0 };
  let readyToDeposit = 0;

  for (const cheque of cheques) {
    if (!isPendingCheque(cheque)) continue;
    const maturity = toDate(cheque.maturityDate);
    if (!maturity || maturity > until) continue;
    if (cheque.direction === 'received') {
      incoming.amount += cheque.amountBase ?? 0;
      incoming.count += 1;
      if (cheque.status === 'holding' && maturity < today) readyToDeposit += 1;
    } else {
      if (maturity < today) continue;
      outgoing.amount += cheque.amountBase ?? 0;
      outgoing.count += 1;
    }
    upcoming.push(cheque);
  }

  upcoming.sort(
    (a, b) => (toDate(a.maturityDate)?.getTime() ?? 0) - (toDate(b.maturityDate)?.getTime() ?? 0),
  );
  return { incoming, outgoing, readyToDeposit, upcoming };
}
