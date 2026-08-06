/**
 * Money-regression tests — mocked Firebase so Jest does not load native modules.
 * Covers: bill commission double-count, overpay rejection on receivables/payables/bills.
 */
import {
  recordBillPayment,
  recordPayablePayment,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';

const mockQueueDocCreate = jest.fn();
const mockQueueDocUpdate = jest.fn();
const mockQueueDocDelete = jest.fn();
const mockQueueDocSet = jest.fn();
const mockForgetSync = jest.fn();

jest.mock('@/lib/firebase/config', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: { uid: 'owner-1' } })),
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/lib/firebase/db', () => ({
  collection: jest.fn((_db, name) => ({ name })),
  doc: jest.fn((_db, _name, id) => ({ id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  Timestamp: { now: jest.fn(() => ({ seconds: 0, nanos: 0 })) },
  query: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@/lib/exchange-rates', () => ({
  convertToBase: jest.fn(async (amount: number) => amount),
}));

jest.mock('@/lib/firebase/local-write', () => ({
  forgetSync: (...args: unknown[]) => mockForgetSync(...args),
  queueDocCreate: (...args: unknown[]) => mockQueueDocCreate(...args),
  queueDocUpdate: (...args: unknown[]) => mockQueueDocUpdate(...args),
  queueDocDelete: (...args: unknown[]) => mockQueueDocDelete(...args),
  queueDocSet: (...args: unknown[]) => mockQueueDocSet(...args),
}));

jest.mock('@/lib/firebase/storage-upload', () => ({
  uploadBlobToStorage: jest.fn(),
}));

jest.mock('@/lib/firebase/phone-utils', () => ({
  normalizePhoneForStorage: jest.fn((p: string) => p),
}));

jest.mock('@/features/workspace/device-contacts-service', () => ({
  normalizePhoneKey: jest.fn((p: string) => p),
}));

jest.mock('@/features/workspace/contact-business-link', () => ({
  findContactForBusiness: jest.fn(),
  linkFieldsFromBusiness: jest.fn(),
  matchBusinessForContact: jest.fn(),
}));

jest.mock('@/features/workspace/ap-normalize', () => ({
  isApOngoing: jest.fn(() => false),
}));

jest.mock('@/features/workspace/gem-lifecycle', () => ({
  applyLifecyclePatch: jest.fn(),
  derivePrimaryStatus: jest.fn(),
  isGemStoneStage: jest.fn(() => true),
  isTerminalOutcome: jest.fn(() => false),
  patchFromFlatStatus: jest.fn(),
  resolveGemLifecycle: jest.fn(),
}));

jest.mock('@/features/workspace/firestore-subscriptions', () => ({
  OWNER_LIST_LIMIT: 50,
}));

jest.mock('@/lib/utils', () => ({
  calcWeightLossPercent: jest.fn(() => 0),
  generateSkuFromDocId: jest.fn(() => 'SKU-1'),
}));

import { getDoc } from '@/lib/firebase/db';

function mockSnap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

function txns(): Array<{ collection: string; data: Record<string, unknown> }> {
  return mockQueueDocCreate.mock.calls
    .map(([collection, data]) => ({ collection, data }))
    .filter((c) => c.collection === 'gemtrack_transactions');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueDocCreate.mockImplementation((_collection: string) => 'doc-1');
  mockForgetSync.mockImplementation((p: unknown) => p);
});

describe('bill commission double-count', () => {
  const bill = {
    ownerUid: 'owner-1',
    direction: 'payable' as const,
    amount: 1000,
    amountSettled: 0,
    commissionPercent: 10,
    currency: 'LKR',
    status: 'open' as const,
    notes: 'Sapphire buy',
    counterpartyContactId: 'contact-1',
  };

  it('books the full gross payment once (no phantom commission line)', async () => {
    (getDoc as jest.Mock).mockResolvedValue(mockSnap(bill));

    await recordBillPayment('owner-1', 'bill-1', 1000, {
      currency: 'LKR',
      paymentMethod: 'cash',
    });

    const t = txns();
    expect(t).toHaveLength(1);
    expect(t[0]!.data.type).toBe('expense');
    expect(t[0]!.data.amount).toBe(1000);
    expect(t[0]!.data.description).not.toContain('after commission');
  });

  it('books receivable at full gross too', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({ ...bill, direction: 'receivable' as const }),
    );

    await recordBillPayment('owner-1', 'bill-1', 1000, {
      currency: 'LKR',
      paymentMethod: 'cash',
    });

    const t = txns();
    expect(t).toHaveLength(1);
    expect(t[0]!.data.type).toBe('income');
    expect(t[0]!.data.amount).toBe(1000);
  });

  it('still records commission metadata on the payment doc', async () => {
    (getDoc as jest.Mock).mockResolvedValue(mockSnap(bill));

    await recordBillPayment('owner-1', 'bill-1', 1000, {
      currency: 'LKR',
      paymentMethod: 'cash',
    });

    const payment = mockQueueDocCreate.mock.calls.find(
      ([c]) => c === 'gemtrack_payments',
    );
    expect(payment).toBeDefined();
    expect(payment![1].amount).toBe(1000);
    expect(payment![1].commission).toBe(100);
  });
});

describe('overpay rejection', () => {
  it('rejects a receivable payment above the remaining balance', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        amount: 100,
        amountReceived: 80,
        currency: 'LKR',
        status: 'partial',
      }),
    );

    await expect(
      recordReceivablePayment('owner-1', 'receivable-1', 50),
    ).rejects.toThrow('exceeds the remaining balance');
    expect(txns()).toHaveLength(0);
  });

  it('accepts an exact-settlement payment', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        amount: 100,
        amountReceived: 80,
        currency: 'LKR',
        status: 'partial',
        title: 'Invoice',
        contactId: null,
      }),
    );

    await recordReceivablePayment('owner-1', 'receivable-1', 20);
    const t = txns();
    expect(t).toHaveLength(1);
    expect(t[0]!.data.amount).toBe(20);
    expect(t[0]!.data.type).toBe('income');
  });

  it('rejects a payable payment above the remaining balance', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        amount: 500,
        amountPaid: 100,
        currency: 'LKR',
        status: 'partial',
      }),
    );

    await expect(
      recordPayablePayment('owner-1', 'payable-1', 600),
    ).rejects.toThrow('exceeds the remaining balance');
  });

  it('rejects a bill payment above the remaining balance', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        direction: 'payable',
        amount: 1000,
        amountSettled: 900,
        status: 'partial',
        currency: 'LKR',
      }),
    );

    await expect(
      recordBillPayment('owner-1', 'bill-1', 200),
    ).rejects.toThrow('exceeds the remaining balance');
    expect(txns()).toHaveLength(0);
  });
});
