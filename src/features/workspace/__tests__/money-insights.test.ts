import {
  gemCostBase,
  getChequeOutlook,
  getStockPosition,
  getStoneSales,
  SLOW_MOVER_DAYS,
} from '@/features/workspace/money-insights';
import type { Cheque, WorkspaceGem } from '@/types';

jest.mock('@/constants/gem-options', () => ({
  formatGemStatusLabel: (status: string) => status,
}));

const ts = (d: Date) => ({ toDate: () => d }) as never;
const NOW = new Date(2026, 9, 15, 12);

function gem(overrides: Partial<WorkspaceGem>): WorkspaceGem {
  return {
    id: 'g1',
    sku: 'SKU-1',
    title: null,
    gemType: 'sapphire',
    currentWeight: 2.1,
    acquisitionDate: ts(new Date(2026, 8, 1)),
    acquisitionCost: 100_000,
    acquisitionCurrency: 'LKR',
    acquisitionCostBase: 100_000,
    totalCost: 120_000,
    totalCostCurrency: 'LKR',
    status: 'polished',
    stoneStage: 'polished',
    custody: null,
    outcome: null,
    isListedOnMarketplace: false,
    askingPrice: null,
    askingPriceCurrency: null,
    soldPrice: null,
    soldPriceCurrency: null,
    soldDate: null,
    ...overrides,
  } as WorkspaceGem;
}

const october = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59), label: 'Oct' };

describe('gemCostBase', () => {
  it('converts a USD total cost at the purchase rate', () => {
    expect(
      gemCostBase(
        gem({
          acquisitionCost: 1000,
          acquisitionCurrency: 'USD',
          acquisitionCostBase: 300_000,
          totalCost: 1200,
          totalCostCurrency: 'USD',
        }),
      ),
    ).toBe(360_000);
  });
});

describe('getStoneSales', () => {
  it('books revenue, cost and margin for stones sold in the range only', () => {
    const sales = getStoneSales(
      [
        gem({ id: 'a', outcome: 'sold', soldPriceBase: 200_000, soldDate: ts(new Date(2026, 9, 10)) }),
        gem({ id: 'b', outcome: 'sold', soldPriceBase: 90_000, soldDate: ts(new Date(2026, 8, 20)) }),
        gem({ id: 'c' }),
      ],
      october,
    );
    expect(sales.count).toBe(1);
    expect(sales.revenue).toBe(200_000);
    expect(sales.cost).toBe(120_000);
    expect(sales.profit).toBe(80_000);
    expect(sales.marginPct).toBe(40);
    expect(sales.stones[0]!.daysHeld).toBe(39);
  });
});

describe('getStockPosition', () => {
  it('groups unsold stones by where they are and skips sold or returned ones', () => {
    const stock = getStockPosition(
      [
        gem({ id: 'hand', askingPriceBase: 180_000 }),
        gem({ id: 'ap', custody: 'on_ap' }),
        gem({ id: 'cutter', custody: 'with_cutter' }),
        gem({ id: 'listed', isListedOnMarketplace: true }),
        gem({ id: 'sold', outcome: 'sold' }),
        gem({ id: 'returned', outcome: 'returned' }),
      ],
      NOW,
    );
    expect(stock.count).toBe(4);
    expect(stock.cost).toBe(480_000);
    const place = (key: string) => stock.places.find((p) => p.key === key)!;
    expect(place('in_hand').count).toBe(1);
    expect(place('on_ap').count).toBe(1);
    expect(place('lapidary').count).toBe(1);
    expect(place('listed').count).toBe(1);
    expect(stock.askingTotal).toBe(180_000);
    expect(stock.pricedCost).toBe(120_000);
  });

  it('flags stones held past the slow-mover threshold', () => {
    const old = new Date(NOW);
    old.setDate(old.getDate() - SLOW_MOVER_DAYS - 5);
    const stock = getStockPosition([gem({ id: 'old', acquisitionDate: ts(old) }), gem({ id: 'new' })], NOW);
    expect(stock.slowMovers.count).toBe(1);
    expect(stock.oldest[0]!.id).toBe('old');
  });
});

describe('getChequeOutlook', () => {
  const cheque = (overrides: Partial<Cheque>) =>
    ({
      id: 'c',
      direction: 'received',
      status: 'holding',
      amountBase: 50_000,
      maturityDate: ts(new Date(2026, 9, 20)),
      ...overrides,
    }) as Cheque;

  it('totals pending cheques clearing within the window by direction', () => {
    const outlook = getChequeOutlook(
      [
        cheque({ id: 'in' }),
        cheque({ id: 'late-in', maturityDate: ts(new Date(2026, 9, 1)) }),
        cheque({ id: 'out', direction: 'given', amountBase: 20_000 }),
        cheque({ id: 'far', maturityDate: ts(new Date(2026, 11, 30)) }),
        cheque({ id: 'cleared', status: 'cleared' }),
      ],
      30,
      NOW,
    );
    expect(outlook.incoming).toEqual({ amount: 100_000, count: 2 });
    expect(outlook.outgoing).toEqual({ amount: 20_000, count: 1 });
    expect(outlook.readyToDeposit).toBe(1);
    expect(outlook.upcoming.map((c) => c.id)).toEqual(['late-in', 'in', 'out']);
  });
});
