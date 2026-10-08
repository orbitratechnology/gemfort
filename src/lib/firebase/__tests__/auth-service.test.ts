/**
 * Pure auth helpers — mocked Firebase so Jest does not load native modules.
 */
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
jest.mock('@/lib/firebase/app-check', () => ({
  getFirebaseAppCheckToken: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/lib/firebase/db', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));
