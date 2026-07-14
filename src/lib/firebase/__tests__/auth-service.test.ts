/**
 * Pure auth helpers — mocked Firebase so Jest does not load native modules.
 */
import { needsPhoneVerification } from '@/lib/firebase/auth-service';
import type { UserProfile } from '@/types';

jest.mock('@/lib/firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('@/lib/firebase/config', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
  getFirebaseDb: jest.fn(() => ({})),
}));
jest.mock('@/lib/firebase/db', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));

describe('needsPhoneVerification', () => {
  it('requires verification when phone present and not verified', () => {
    expect(
      needsPhoneVerification({
        phone: '+94770000001',
        phoneVerified: false,
      } as UserProfile),
    ).toBe(true);
  });

  it('skips when phoneVerified', () => {
    expect(
      needsPhoneVerification({
        phone: '+94770000001',
        phoneVerified: true,
      } as UserProfile),
    ).toBe(false);
  });

  it('skips when no phone', () => {
    expect(needsPhoneVerification({ phone: '', phoneVerified: false } as UserProfile)).toBe(false);
  });
});
