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

let googleConfigured = false;

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
    await signOut(auth);
    throw new Error('Choose a role on Sign Up before continuing with a provider.');
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
  configureGoogle();
  await GoogleOneTapSignIn.checkPlayServices(true);

  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
  if (!isSuccessResponse(response) || !response.data?.idToken) {
    throw new Error('Google Sign-In was cancelled or did not return an ID token.');
  }

  return finishSocialSignIn(
    GoogleAuthProvider.credential(response.data.idToken),
    role,
    {
      email: response.data.user.email,
      displayName: response.data.user.name,
    },
  );
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
  );
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
