import {
  linkWithCredential,
  PhoneAuthProvider,
  signInWithPhoneNumber,
} from '@react-native-firebase/auth';

import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/config';
import { doc, serverTimestamp, updateDoc } from '@/lib/firebase/db';

export async function sendPhoneVerificationCode(phoneE164: string): Promise<string> {
  const confirmation = await signInWithPhoneNumber(getFirebaseAuth(), phoneE164);
  if (!confirmation.verificationId) {
    throw new Error('Phone verification could not be started.');
  }
  return confirmation.verificationId;
}

export async function confirmPhoneVerificationCode(
  verificationId: string,
  code: string,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You must be signed in to verify your phone.');

  const credential = PhoneAuthProvider.credential(verificationId, code);
  await linkWithCredential(user, credential);

  await updateDoc(doc(getFirebaseDb(), 'users', user.uid), {
    phoneVerified: true,
    updatedAt: serverTimestamp(),
  });
}

export async function skipPhoneVerificationForDev(uid: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'users', uid), {
    phoneVerified: true,
    updatedAt: serverTimestamp(),
  });
}
