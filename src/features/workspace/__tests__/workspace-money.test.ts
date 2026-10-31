/**
 * Money-regression tests — mocked Firebase so Jest does not load native modules.
 * Covers: bill commission double-count, overpay rejection on receivables/payables/bills,
 * cross-currency settlement and all-or-nothing payment writes.
 */
import {
  recordBillPayment,
  recordPayablePayment,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { convertFromBase, convertToBase } from '@/lib/exchange-rates';
import { getDoc } from '@/lib/firebase/db';

const mockQueueDocCreate = jest.fn();
const mockQueueDocUpdate = jest.fn();
const mockQueueDocDelete = jest.fn();
const mockQueueDocSet = jest.fn();
const mockForgetSync = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockRunTransaction = jest.fn();
const mockDb = {};

jest.mock('@/lib/firebase/config', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: { uid: 'owner-1' } })),
  getFirebaseDb: jest.fn(() => mockDb),
}));

jest.mock('@/lib/firebase/db', () => ({
  collection: jest.fn((_db, name) => ({ name })),
  doc: jest.fn((dbOrCollection, name, id) => ({
    id: id ?? `${dbOrCollection.name ?? name}-1`,
    collection: id == null ? dbOrCollection.name : name,
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: jest.fn((_db, callback) => mockRunTransaction(callback)),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  Timestamp: { now: jest.fn(() => ({ seconds: 0, nanos: 0 })) },
  query: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

// 1 USD = 300 LKR; every other currency is treated as LKR.
jest.mock('@/lib/exchange-rates', () => ({
  convertToBase: jest.fn(async (amount: number, currency: string) =>
    currency === 'USD' ? amount * 300 : amount,
  ),
  convertFromBase: jest.fn(async (amountBase: number, currency: string) =>
    currency === 'USD' ? amountBase / 300 : amountBase,
  ),
}));

jest.mock('@/lib/firebase/local-write', () => ({
  forgetSync: (...args: unknown[]) => mockForgetSync(...args),
  queueDocCreate: (...args: unknown[]) => mockQueueDocCreate(...args),
  queueDocUpdate: (...args: unknown[]) => mockQueueDocUpdate(...args),
  queueDocDelete: (...args: unknown[]) => mockQueueDocDelete(...args),
  queueDocSet: (...args: unknown[]) => mockQueueDocSet(...args),
}));

jest.mock('@react-native-firebase/storage', () => ({
  deleteObject: jest.fn(),
  getStorage: jest.fn(),
  ref: jest.fn(),
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-1') }));

jest.mock('@/lib/firebase/storage-service', () => ({
  extensionForMedia: jest.fn(() => 'jpg'),
  uploadLocalMedia: jest.fn(),
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

function mockSnap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

function txns(): { collection: string; data: Record<string, unknown> }[] {
  const transactionWrites = mockTransactionSet.mock.calls.map(([ref, data]) => ({
    collection: ref.collection,
    data,
  }));
  const queuedWrites = mockQueueDocCreate.mock.calls.map(([collection, data]) => ({
    collection,
    data,
  }));
  return [...transactionWrites, ...queuedWrites]
    .filter((c) => c.collection === 'gemtrack_transactions');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueDocCreate.mockImplementation((_collection: string) => 'doc-1');
  mockForgetSync.mockImplementation((p: unknown) => p);
  mockRunTransaction.mockImplementation(
    async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: (ref: unknown) => getDoc(ref),
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      }),
  );
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

    const payment = mockTransactionSet.mock.calls.find(
      ([ref]) => ref.collection === 'gemtrack_payments',
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

describe('cross-currency settlement', () => {
  const usdReceivable = {
    ownerUid: 'owner-1',
    amount: 1000,
    amountReceived: 0,
    currency: 'USD',
    status: 'pending',
    title: 'Ruby on credit',
    contactId: null,
  };

  it('converts an LKR payment into the USD balance', async () => {
    (getDoc as jest.Mock).mockResolvedValue(mockSnap(usdReceivable));

    await recordReceivablePayment('owner-1', 'receivable-1', 30_000, { currency: 'LKR' });

    const update = mockTransactionUpdate.mock.calls[0]![1];
    expect(update.amountReceived).toBe(100);
    expect(update.status).toBe('partial');
    const t = txns();
    expect(t).toHaveLength(1);
    expect(t[0]!.data).toMatchObject({ amount: 30_000, currency: 'LKR', amountBase: 30_000 });
  });

  it('does not treat 1,000 LKR as settling 1,000 USD', async () => {
    (getDoc as jest.Mock).mockResolvedValue(mockSnap(usdReceivable));

    await recordReceivablePayment('owner-1', 'receivable-1', 1000, { currency: 'LKR' });

    const update = mockTransactionUpdate.mock.calls[0]![1];
    expect(update.status).toBe('partial');
    expect(update.amountReceived).toBeCloseTo(3.33, 2);
  });

  it('rejects a converted payment above the remaining balance', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({ ...usdReceivable, amountReceived: 900 }),
    );

    await expect(
      recordReceivablePayment('owner-1', 'receivable-1', 60_000, { currency: 'LKR' }),
    ).rejects.toThrow('exceeds the remaining balance');
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });
});

describe('all-or-nothing payment writes', () => {
  it('writes nothing when currency conversion fails', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        amount: 500,
        amountPaid: 0,
        currency: 'LKR',
        status: 'pending',
        title: 'Parcel advance',
        contactId: null,
      }),
    );
    (convertToBase as jest.Mock).mockRejectedValueOnce(
      new Error('Currency conversion is temporarily unavailable.'),
    );

    await expect(
      recordPayablePayment('owner-1', 'payable-1', 100, { currency: 'USD' }),
    ).rejects.toThrow('temporarily unavailable');
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockQueueDocCreate).not.toHaveBeenCalled();
    expect(convertFromBase).not.toHaveBeenCalled();
  });

  it('writes the balance, transaction and payment in one transaction', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      mockSnap({
        ownerUid: 'owner-1',
        amount: 500,
        amountPaid: 0,
        currency: 'LKR',
        status: 'pending',
        title: 'Parcel advance',
        contactId: 'contact-1',
      }),
    );

    await recordPayablePayment('owner-1', 'payable-1', 500);

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransactionUpdate.mock.calls[0]![1]).toMatchObject({
      amountPaid: 500,
      status: 'paid',
    });
    const collections = mockTransactionSet.mock.calls.map(([ref]) => ref.collection);
    expect(collections.sort()).toEqual(['gemtrack_payments', 'gemtrack_transactions']);
    expect(mockQueueDocCreate).not.toHaveBeenCalled();
    expect(mockForgetSync).not.toHaveBeenCalled();
  });
});
