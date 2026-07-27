import {
  budgetRemaining,
  budgetUsedPercent,
  canCompleteTrip,
  canStartTrip,
  computeTripSummary,
  isActiveTrip,
  tripBudgetBase,
  tripBudgetSpent,
  tripCashCarriedBase,
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

describe('budget helpers', () => {
  const trip = {
    budget: 300000,
    budgetBase: 300000,
    cashCarried: 200,
    cashCarriedBase: 67249.5,
  } as Trip;

  it('prefers stored base amounts', () => {
    expect(tripBudgetBase(trip)).toBe(300000);
    expect(tripCashCarriedBase(trip)).toBe(67249.5);
  });

  it('computes spent, remaining, and used percent from budgetBase', () => {
    const spent = tripBudgetSpent(40000, 10000);
    expect(spent).toBe(50000);
    expect(budgetRemaining(trip, spent)).toBe(250000);
    expect(budgetUsedPercent(trip, spent)).toBe(17);
    expect(budgetUsedPercent(trip, 400000)).toBe(100);
    expect(budgetUsedPercent({ budget: 0 } as Trip, 50)).toBe(0);
  });
});
