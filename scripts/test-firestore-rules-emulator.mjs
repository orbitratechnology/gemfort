/**
 * Firestore rules tests against the local emulator.
 *
 * Usage: bun run test:rules:emulator
 * (wraps `firebase emulators:exec --only firestore`; needs JDK 21+).
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
}

const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');

const ADMIN = 'admin-uid';
const TRADER = 'trader-uid';
const LAPIDARY = 'lapidary-uid';
const OWNER = 'owner-uid';
const VIEWER = 'viewer-uid';
const SUSPENDED = 'suspended-uid';

const user = (role, extra = {}) => ({
  role,
  isSuspended: false,
  isActive: true,
  verificationStatus: 'verified',
  ...extra,
});

const business = (extra = {}) => ({
  ownerUid: OWNER,
  businessName: 'Ratnapura Gems',
  verificationStatus: 'verified',
  isActive: true,
  analytics: {
    profileViewsTotal: 4,
    listingViewsTotal: 0,
    whatsappTapsTotal: 2,
    phoneTapsTotal: 0,
  },
  ...extra,
});

const gem = (visibility, extra = {}) => ({
  sellerUid: TRADER,
  businessId: 'biz-trader',
  status: 'active',
  visibility,
  shareableSlug: `slug-${visibility}`,
  analytics: { totalViews: 0, whatsappTaps: 0 },
  ...extra,
});

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-gemfort',
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.now();
    await Promise.all([
      setDoc(doc(db, 'users', ADMIN), user('admin')),
      setDoc(doc(db, 'users', TRADER), user('trader')),
      setDoc(doc(db, 'users', LAPIDARY), user('lapidary')),
      setDoc(doc(db, 'users', OWNER), user('trader')),
      setDoc(doc(db, 'users', VIEWER), user('trader', { verificationStatus: 'none' })),
      setDoc(doc(db, 'users', SUSPENDED), user('trader', { isSuspended: true })),

      setDoc(doc(db, 'businesses', 'biz-verified'), business()),
      setDoc(doc(db, 'businesses', 'biz-pending'), business({ verificationStatus: 'pending' })),
      setDoc(doc(db, 'public_businesses', 'biz-verified'), {
        businessName: 'Ratnapura Gems',
        verificationStatus: 'verified',
        isActive: true,
      }),

      setDoc(doc(db, 'gems', 'gem-public'), gem('public')),
      setDoc(doc(db, 'gems', 'gem-contacts'), gem('contacts')),
      setDoc(doc(db, 'gems', 'gem-private'), gem('private')),
      setDoc(doc(db, 'gems', 'gem-members'), gem('members_only')),

      setDoc(doc(db, 'service_requests', 'sr-1'), {
        traderUid: TRADER,
        lapidaryUid: LAPIDARY,
        status: 'pending',
        notes: null,
        updatedAt: now,
      }),
      setDoc(doc(db, 'lapidary_jobs', 'job-1'), {
        serviceRequestId: 'sr-1',
        traderUid: TRADER,
        lapidaryUid: LAPIDARY,
        status: 'queued',
        notes: null,
        updatedAt: now,
      }),

      setDoc(doc(db, 'companies', 'co-1'), { ownerUid: OWNER }),
      setDoc(doc(db, 'company_members', `co-1_${OWNER}`), {
        userUid: OWNER,
        isActive: true,
        subRole: 'owner',
      }),
      setDoc(doc(db, 'company_approvals', 'ap-1'), {
        requestedByUid: OWNER,
        approverUid: VIEWER,
      }),
      setDoc(doc(db, 'company_audit_logs', 'log-1'), { companyId: 'co-1' }),
    ]);
  });
});

const guestDb = () => testEnv.unauthenticatedContext().firestore();
const authedDb = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('existing coverage', () => {
  test('guest can read a verified public business projection', async () => {
    await assertSucceeds(getDoc(doc(guestDb(), 'public_businesses', 'biz-verified')));
  });

  test('guest cannot read the private business document', async () => {
    await assertFails(getDoc(doc(guestDb(), 'businesses', 'biz-verified')));
  });

  test('user can read their own profile', async () => {
    await assertSucceeds(getDoc(doc(authedDb(TRADER), 'users', TRADER)));
  });

  test('user cannot read another profile', async () => {
    await assertFails(getDoc(doc(authedDb(VIEWER), 'users', TRADER)));
  });
});

describe('gems: legacy private / members_only visibility', () => {
  test('guest can read an active public listing', async () => {
    await assertSucceeds(getDoc(doc(guestDb(), 'gems', 'gem-public')));
  });

  test('signed-in viewer can read a contacts listing; guest cannot', async () => {
    await assertSucceeds(getDoc(doc(authedDb(VIEWER), 'gems', 'gem-contacts')));
    await assertFails(getDoc(doc(guestDb(), 'gems', 'gem-contacts')));
  });

  for (const id of ['gem-private', 'gem-members']) {
    test(`guest cannot read ${id}`, async () => {
      await assertFails(getDoc(doc(guestDb(), 'gems', id)));
    });

    test(`signed-in non-owner cannot read ${id}`, async () => {
      await assertFails(getDoc(doc(authedDb(VIEWER), 'gems', id)));
    });

    test(`owner and admin can still read ${id}`, async () => {
      await assertSucceeds(getDoc(doc(authedDb(TRADER), 'gems', id)));
      await assertSucceeds(getDoc(doc(authedDb(ADMIN), 'gems', id)));
    });
  }

  const slugQuery = (db, slug, visibilities) =>
    getDocs(
      query(
        collection(db, 'gems'),
        where('shareableSlug', '==', slug),
        where('status', '==', 'active'),
        where('visibility', 'in', visibilities),
        limit(1),
      ),
    );

  test('slug lookup with app visibilities succeeds', async () => {
    await assertSucceeds(slugQuery(guestDb(), 'slug-public', ['public']));
    await assertSucceeds(slugQuery(authedDb(VIEWER), 'slug-contacts', ['public', 'contacts']));
  });

  test('slug lookup including legacy visibilities is rejected', async () => {
    await assertFails(slugQuery(guestDb(), 'slug-private', ['public', 'private', 'members_only']));
  });
});

describe('businesses: analytics taps', () => {
  const tap = (db, id, field, by = 1, extra = {}) =>
    updateDoc(doc(db, 'businesses', id), {
      [`analytics.${field}`]: increment(by),
      updatedAt: serverTimestamp(),
      ...extra,
    });

  test('signed-in viewer can bump each counter by 1', async () => {
    const db = authedDb(VIEWER);
    await assertSucceeds(tap(db, 'biz-verified', 'profileViewsTotal'));
    await assertSucceeds(tap(db, 'biz-verified', 'whatsappTapsTotal'));
    await assertSucceeds(tap(db, 'biz-verified', 'phoneTapsTotal'));
  });

  test('guest cannot tap', async () => {
    await assertFails(tap(guestDb(), 'biz-verified', 'profileViewsTotal'));
  });

  test('suspended user cannot tap', async () => {
    await assertFails(tap(authedDb(SUSPENDED), 'biz-verified', 'profileViewsTotal'));
  });

  test('cannot bump by more than 1', async () => {
    await assertFails(tap(authedDb(VIEWER), 'biz-verified', 'profileViewsTotal', 5));
  });

  test('cannot decrement', async () => {
    await assertFails(tap(authedDb(VIEWER), 'biz-verified', 'profileViewsTotal', -1));
  });

  test('cannot bump two counters at once', async () => {
    await assertFails(
      updateDoc(doc(authedDb(VIEWER), 'businesses', 'biz-verified'), {
        'analytics.profileViewsTotal': increment(1),
        'analytics.phoneTapsTotal': increment(1),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test('cannot bump a counter outside the allowlist', async () => {
    await assertFails(tap(authedDb(VIEWER), 'biz-verified', 'listingViewsTotal'));
  });

  test('cannot overwrite or reset the analytics map', async () => {
    const db = authedDb(VIEWER);
    await assertFails(
      updateDoc(doc(db, 'businesses', 'biz-verified'), {
        analytics: { profileViewsTotal: 1_000_000 },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'businesses', 'biz-verified'), {
        'analytics.profileViewsTotal': 0,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test('cannot set a client-chosen updatedAt', async () => {
    await assertFails(
      updateDoc(doc(authedDb(VIEWER), 'businesses', 'biz-verified'), {
        'analytics.profileViewsTotal': increment(1),
        updatedAt: Timestamp.fromDate(new Date('2030-01-01')),
      }),
    );
  });

  test('cannot touch other fields alongside a tap', async () => {
    await assertFails(
      tap(authedDb(VIEWER), 'biz-verified', 'profileViewsTotal', 1, { businessName: 'Hijacked' }),
    );
  });

  test('cannot tap an unverified business', async () => {
    await assertFails(tap(authedDb(VIEWER), 'biz-pending', 'profileViewsTotal'));
  });

  test('owner can still edit their profile but not analytics directly', async () => {
    const db = authedDb(OWNER);
    await assertSucceeds(
      updateDoc(doc(db, 'businesses', 'biz-verified'), { businessName: 'Ratnapura Gems Ltd' }),
    );
    await assertFails(
      updateDoc(doc(db, 'businesses', 'biz-verified'), { 'analytics.profileViewsTotal': 999 }),
    );
  });
});

describe('service_requests / lapidary_jobs: client writes closed', () => {
  test('participants can read; outsiders cannot', async () => {
    await assertSucceeds(getDoc(doc(authedDb(TRADER), 'service_requests', 'sr-1')));
    await assertSucceeds(getDoc(doc(authedDb(LAPIDARY), 'service_requests', 'sr-1')));
    await assertSucceeds(getDoc(doc(authedDb(TRADER), 'lapidary_jobs', 'job-1')));
    await assertSucceeds(getDoc(doc(authedDb(LAPIDARY), 'lapidary_jobs', 'job-1')));
    await assertFails(getDoc(doc(authedDb(VIEWER), 'service_requests', 'sr-1')));
    await assertFails(getDoc(doc(authedDb(VIEWER), 'lapidary_jobs', 'job-1')));
  });

  test('trader and lapidary cannot update a service request', async () => {
    await assertFails(
      updateDoc(doc(authedDb(TRADER), 'service_requests', 'sr-1'), { status: 'completed' }),
    );
    await assertFails(
      updateDoc(doc(authedDb(LAPIDARY), 'service_requests', 'sr-1'), { status: 'accepted' }),
    );
    await assertFails(
      updateDoc(doc(authedDb(LAPIDARY), 'service_requests', 'sr-1'), { traderUid: LAPIDARY }),
    );
  });

  test('participants cannot update a lapidary job', async () => {
    await assertFails(
      updateDoc(doc(authedDb(LAPIDARY), 'lapidary_jobs', 'job-1'), { status: 'ready' }),
    );
    await assertFails(
      updateDoc(doc(authedDb(TRADER), 'lapidary_jobs', 'job-1'), { status: 'returned' }),
    );
  });

  test('verified trader / lapidary cannot create documents directly', async () => {
    await assertFails(
      setDoc(doc(authedDb(TRADER), 'service_requests', 'sr-new'), {
        traderUid: TRADER,
        lapidaryUid: LAPIDARY,
        status: 'pending',
      }),
    );
    await assertFails(
      setDoc(doc(authedDb(LAPIDARY), 'lapidary_jobs', 'job-new'), {
        traderUid: TRADER,
        lapidaryUid: LAPIDARY,
        status: 'queued',
      }),
    );
  });

  test('admin can update status but not reassign participants', async () => {
    const db = authedDb(ADMIN);
    await assertSucceeds(updateDoc(doc(db, 'service_requests', 'sr-1'), { status: 'cancelled' }));
    await assertSucceeds(updateDoc(doc(db, 'lapidary_jobs', 'job-1'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(db, 'service_requests', 'sr-1'), { traderUid: VIEWER }));
    await assertFails(updateDoc(doc(db, 'lapidary_jobs', 'job-1'), { lapidaryUid: VIEWER }));
    await assertFails(updateDoc(doc(db, 'lapidary_jobs', 'job-1'), { serviceRequestId: 'sr-2' }));
  });
});

describe('removed enterprise collections', () => {
  test('members, approvers and admins are all denied', async () => {
    await assertFails(getDoc(doc(authedDb(OWNER), 'companies', 'co-1')));
    await assertFails(getDoc(doc(authedDb(OWNER), 'company_members', `co-1_${OWNER}`)));
    await assertFails(getDoc(doc(authedDb(VIEWER), 'company_approvals', 'ap-1')));
    await assertFails(getDoc(doc(authedDb(OWNER), 'company_audit_logs', 'log-1')));
    await assertFails(getDoc(doc(authedDb(ADMIN), 'companies', 'co-1')));
    await assertFails(
      setDoc(doc(authedDb(VIEWER), 'company_approvals', 'ap-2'), { requestedByUid: VIEWER }),
    );
  });
});
