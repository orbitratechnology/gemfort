import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

import {
  AppleAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut,
} from '@/lib/firebase/auth';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/config';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from '@/lib/firebase/db';
import type { UserProfile, UserRole } from '@/types';

type SocialSignInResult = {
  user: { uid: string; email: string | null; displayName: string | null };
  profile: UserProfile;
  isNewProfile: boolean;
};

type ProfileIdentity = {
  email?: string | null;
  displayName?: string | null;
};

type PendingSocialRegistration = {
  provider: 'google' | 'apple';
  credential: Parameters<typeof signInWithCredential>[1];
  identity: ProfileIdentity;
};

export class SocialRegistrationRequiredError extends Error {
  readonly code = 'social/registration-required';

  constructor() {
    super('Complete registration to finish signing in.');
    this.name = 'SocialRegistrationRequiredError';
  }
}

let googleConfigured = false;
let pendingSocialRegistration: PendingSocialRegistration | null = null;

function logGoogleDiagnostic(stage: string, error: unknown) {
  const details =
    typeof error === 'object' && error !== null
      ? {
          name: 'name' in error ? String(error.name ?? '') : undefined,
          code: 'code' in error ? String(error.code ?? '') : undefined,
          message: 'message' in error ? String(error.message ?? '') : undefined,
        }
      : { message: String(error) };

  console.error(`[GoogleSignIn] ${stage}`, details);
}

function configureGoogle() {
  if (googleConfigured) return;
  GoogleOneTapSignIn.configure({ webClientId: 'autoDetect' });
  googleConfigured = true;
}

function defaultDisplayName(identity: ProfileIdentity, fallback: string | null) {
  return identity.displayName?.trim() || fallback?.trim() || 'GemFort member';
}

async function finishSocialSignIn(
  credential: Parameters<typeof signInWithCredential>[1],
  role: UserRole | undefined,
  identity: ProfileIdentity,
  provider: PendingSocialRegistration['provider'],
): Promise<SocialSignInResult> {
  const auth = getFirebaseAuth();
  const result = await signInWithCredential(auth, credential);
  const user = result.user;
  const profileRef = doc(getFirebaseDb(), 'users', user.uid);
  const existing = await getDoc(profileRef);

  if (existing.exists()) {
    const profile = { uid: user.uid, ...existing.data() } as UserProfile;
    if (profile.isSuspended) {
      await signOut(auth);
      throw new Error(profile.suspendedReason ?? 'Your account has been suspended.');
    }
    await updateDoc(profileRef, {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { user, profile, isNewProfile: false };
  }

  if (!role) {
    pendingSocialRegistration = { provider, credential, identity };
    await signOut(auth);
    throw new SocialRegistrationRequiredError();
  }

  const email = identity.email?.trim().toLowerCase() || user.email?.trim().toLowerCase();
  if (!email) {
    await signOut(auth);
    throw new Error('Your provider did not return an email address.');
  }

  const profile: Omit<UserProfile, 'createdAt' | 'lastActiveAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastActiveAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid: user.uid,
    email,
    phone: '',
    displayName: defaultDisplayName(identity, user.displayName),
    role,
    roleIntent: role,
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

  // AuthProvider retries profile reads after auth state changes. Creating the
  // profile immediately prevents a first-time federated session becoming orphaned.
  await setDoc(profileRef, profile);
  return { user, profile: profile as unknown as UserProfile, isNewProfile: true };
}

export async function signInWithGoogle(role?: UserRole): Promise<SocialSignInResult> {
  try {
    configureGoogle();
    console.info('[GoogleSignIn] configured');

    await GoogleOneTapSignIn.checkPlayServices(true);
    console.info('[GoogleSignIn] Play Services available');

    let response = await GoogleOneTapSignIn.signIn();
    console.info('[GoogleSignIn] signIn response', {
      type: response.type,
      hasIdToken: isSuccessResponse(response) && Boolean(response.data?.idToken),
    });
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.createAccount();
      console.info('[GoogleSignIn] createAccount response', { type: response.type });
    }
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.presentExplicitSignIn();
      console.info('[GoogleSignIn] explicitSignIn response', { type: response.type });
    }
    if (!isSuccessResponse(response) || !response.data?.idToken) {
      const error = new Error('Google Sign-In was cancelled or did not return an ID token.');
      logGoogleDiagnostic('no ID token', error);
      throw error;
    }

    console.info('[GoogleSignIn] ID token received; exchanging with Firebase');
    return await finishSocialSignIn(
      GoogleAuthProvider.credential(response.data.idToken),
      role,
      {
        email: response.data.user.email,
        displayName: response.data.user.name,
      },
      'google',
    );
  } catch (error) {
    logGoogleDiagnostic('sign-in failed', error);
    throw error;
  }
}

export async function signInWithApple(role?: UserRole): Promise<SocialSignInResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!apple.identityToken) {
    throw new Error('Apple Sign-In did not return an identity token.');
  }

  const displayName = AppleAuthentication.formatFullName(apple.fullName ?? {
    namePrefix: null,
    givenName: null,
    middleName: null,
    familyName: null,
    nameSuffix: null,
    nickname: null,
  });
  return finishSocialSignIn(
    AppleAuthProvider.credential(apple.identityToken, rawNonce),
    role,
    { email: apple.email, displayName },
    'apple',
  );
}

export function isSocialRegistrationRequired(error: unknown): error is SocialRegistrationRequiredError {
  return error instanceof SocialRegistrationRequiredError;
}

export function getPendingSocialRegistration() {
  return pendingSocialRegistration;
}

export async function completePendingSocialRegistration(role: UserRole) {
  const pending = pendingSocialRegistration;
  if (!pending) {
    throw new Error('The social registration session has expired. Please try again.');
  }

  const result = await finishSocialSignIn(
    pending.credential,
    role,
    pending.identity,
    pending.provider,
  );
  pendingSocialRegistration = null;
  return result;
}

export async function reauthenticateWithGoogle() {
  configureGoogle();
  await GoogleOneTapSignIn.checkPlayServices(true);
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (!isSuccessResponse(response) || !response.data?.idToken) {
    throw new Error('Google Sign-In was cancelled or did not return an ID token.');
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You must be signed in to continue.');
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(response.data.idToken));
}

export async function reauthenticateWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  const apple = await AppleAuthentication.signInAsync({ nonce: hashedNonce });
  if (!apple.identityToken) throw new Error('Apple Sign-In did not return an identity token.');
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You must be signed in to continue.');
  await reauthenticateWithCredential(user, AppleAuthProvider.credential(apple.identityToken, rawNonce));
}
