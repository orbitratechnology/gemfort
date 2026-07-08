import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from '@/lib/firebase/auth';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@/lib/firebase/db';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';
import type { UserProfile, UserRole } from '@/types';

export type { AuthUser } from '@/lib/firebase/auth-types';

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  roleIntent: UserRole;
}) {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    input.email.trim(),
    input.password,
  );
  await updateProfile(credential.user, { displayName: input.displayName.trim() });

  const profile: Omit<UserProfile, 'createdAt' | 'lastActiveAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastActiveAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid: credential.user.uid,
    email: input.email.trim().toLowerCase(),
    phone: normalizePhoneNumber(input.phone),
    displayName: input.displayName.trim(),
    role: 'normal_user',
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

  await setDoc(doc(getFirebaseDb(), 'users', credential.user.uid), {
    ...profile,
    roleIntent: input.roleIntent,
  });

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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export function needsPhoneVerification(profile: UserProfile | null): boolean {
  return !!profile?.phone && profile.phoneVerified !== true;
}

export async function updateFcmToken(uid: string, token: string | null) {
  await updateDoc(doc(getFirebaseDb(), 'users', uid), {
    fcmToken: token,
    updatedAt: serverTimestamp(),
  });
}
