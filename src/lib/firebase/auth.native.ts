export {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  linkWithCredential,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  getIdToken,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from '@react-native-firebase/auth';

export type { FirebaseAuthTypes } from '@react-native-firebase/auth';
