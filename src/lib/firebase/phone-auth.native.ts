import auth from '@react-native-firebase/auth';

import { doc, serverTimestamp, updateDoc } from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';

export async function sendPhoneVerificationCode(phoneE164: string): Promise<string> {
  const confirmation = await auth().signInWithPhoneNumber(phoneE164);
  if (!confirmation.verificationId) {
    throw new Error('Phone verification could not be started.');
  }
  return confirmation.verificationId;
}

export async function confirmPhoneVerificationCode(
  verificationId: string,
  code: string,
): Promise<void> {
  const user = auth().currentUser;
  if (!user) throw new Error('You must be signed in to verify your phone.');

  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  await user.linkWithCredential(credential);

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
