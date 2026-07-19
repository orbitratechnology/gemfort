import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdToken,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from '@/lib/firebase/auth';
import { callFunction } from '@/lib/firebase/call-function';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@/lib/firebase/db';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';
import { clearOnboardingState } from '@/lib/onboarding';
import { clearThemePreference } from '@/lib/theme-preference';
import { isRegisterableRole } from '@/constants/roles';
import type { UserProfile, UserRole } from '@/types';

export type { AuthUser } from '@/lib/firebase/auth-types';

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  role: UserRole;
}) {
  if (!isRegisterableRole(input.role)) {
    throw new Error('Select Trader, Lapidary, or Gem Lab to continue.');
  }

  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );
  const uid = credential.user.uid;
  const displayName = input.displayName.trim();

  // Write Firestore BEFORE Auth profile updates. AuthProvider loads the user
  // doc on auth state change; if it's missing it signs out as an "orphan",
  // which races updateProfile and causes auth/no-current-user.
  const profile: Omit<UserProfile, 'createdAt' | 'lastActiveAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastActiveAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid,
    email: input.email.trim().toLowerCase(),
    phone: normalizePhoneNumber(input.phone),
    displayName,
    role: input.role,
    roleIntent: input.role,
    verificationStatus: 'none',
    preferredCurrency: 'LKR',
    preferredLanguage: 'en',
    isActive: true,
    isSuspended: false,
    suspendedReason: null,
    suspendedAt: null,
    companyId: null,
    fcmToken: null,
    phoneVerified: false,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(getFirebaseDb(), 'users', uid), profile);

  // Auth displayName is optional — Firestore is the source of truth.
  const current = auth.currentUser;
  if (current?.uid === uid) {
    try {
      await updateProfile(current, { displayName });
    } catch {
      // Non-fatal (e.g. brief session race); profile doc already has the name.
    }
  }

  return { user: credential.user, phone: normalizePhoneNumber(input.phone) };
}

export async function loginUser(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  const profile = await getUserProfile(credential.user.uid);
  if (profile?.isSuspended) {
    await signOut(getFirebaseAuth());
    throw new Error(profile.suspendedReason ?? 'Your account has been suspended.');
  }
  await updateDoc(doc(getFirebaseDb(), 'users', credential.user.uid), {
    lastActiveAt: serverTimestamp(),
  });
  return credential.user;
}

export async function logoutUser() {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await updateDoc(doc(getFirebaseDb(), 'users', uid), {
        fcmToken: null,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking
    }
  }
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/** Send a password-reset email to the signed-in user's address. */
export async function sendPasswordResetForCurrentUser() {
  const user = getFirebaseAuth().currentUser;
  const email = user?.email?.trim();
  if (!user || !email) {
    throw new Error('Sign in with an email account to reset your password.');
  }
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

async function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) {
    throw new Error('Sign in with an email account to continue.');
  }
  return user;
}

/** Fresh sign-in proof required before password change / account deletion. */
export async function reauthenticateWithPassword(password: string) {
  const user = await requireCurrentUser();
  const credential = EmailAuthProvider.credential(user.email!, password);
  await reauthenticateWithCredential(user, credential);
  return user;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await reauthenticateWithPassword(currentPassword);
  await updatePassword(user, newPassword);
}

/**
 * Reauthenticate, wipe server data via callable, delete Auth user, clear local prefs.
 * Cloud Function also runs onAuthUserDeleted as a safety net.
 */
export async function deleteAccount(password: string) {
  await reauthenticateWithPassword(password);
  await callFunction<{ ok: true }>('deleteMyAccount');
  try {
    await Promise.all([clearOnboardingState(), clearThemePreference()]);
  } catch {
    // Local prefs are best-effort after the account is already gone.
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export function needsPhoneVerification(profile: UserProfile | null): boolean {
  return !!profile?.phone && profile.phoneVerified !== true;
}

export async function updateFcmToken(uid: string, token: string | null) {
  const auth = getFirebaseAuth();
  const current = auth.currentUser;
  if (!current || current.uid !== uid) {
    throw new Error('Not signed in as the target user');
  }
  // Ensure Auth ID token is attached before the Firestore write (avoids
  // permission-denied when push registration races auth restore on Android).
  await getIdToken(current);

  await updateDoc(doc(getFirebaseDb(), 'users', uid), {
    fcmToken: token,
    updatedAt: serverTimestamp(),
  });
}
