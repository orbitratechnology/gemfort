import {
  budgetUsedPercent,
  canCompleteTrip,
  canStartTrip,
  computeTripSummary,
  isActiveTrip,
} from '@/features/workspace/trip-utils';
import type { Trip, TripExpense, TripGem, WorkspaceGem } from '@/types';

describe('trip status helpers', () => {
  it('treats planning and ongoing as active', () => {
    expect(isActiveTrip({ status: 'planning' } as Trip)).toBe(true);
    expect(isActiveTrip({ status: 'ongoing' } as Trip)).toBe(true);
    expect(isActiveTrip({ status: 'completed' } as Trip)).toBe(false);
  });

  it('gates start/complete transitions', () => {
    expect(canStartTrip('planning')).toBe(true);
    expect(canStartTrip('ongoing')).toBe(false);
    expect(canCompleteTrip('ongoing')).toBe(true);
    expect(canCompleteTrip('planning')).toBe(false);
  });
});

describe('computeTripSummary', () => {
  it('nets revenue against expenses and purchase spend', () => {
    const expenses = [{ amountBase: 10000 }] as TripExpense[];
    const tripGems = [
      { role: 'purchase', purchaseCost: 50000, status: 'on_trip' },
      { role: 'parcel', salePrice: 80000, status: 'sold' },
    ] as TripGem[];
    const summary = computeTripSummary(expenses, tripGems, [] as WorkspaceGem[]);
    expect(summary.totalExpenses).toBe(10000);
    expect(summary.purchaseSpend).toBe(50000);
    expect(summary.totalRevenue).toBe(80000);
    expect(summary.netResult).toBe(20000);
  });
});

describe('budgetUsedPercent', () => {
  it('caps at 100', () => {
    expect(budgetUsedPercent({ budget: 100 } as Trip, 150)).toBe(100);
    expect(budgetUsedPercent({ budget: 0 } as Trip, 50)).toBe(0);
  });
});
