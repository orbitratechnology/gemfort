import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut } from '@/lib/firebase/auth';
import type { AuthUser } from '@/lib/firebase/auth-types';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserProfile } from '@/lib/firebase/auth-service';
import type { UserProfile } from '@/types';

type AuthContextValue = {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);
  const profileRequestRef = useRef(0);

  const loadProfile = useCallback(async (uid: string) => {
    const requestId = ++profileRequestRef.current;
    try {
      // Registration writes the Firestore user doc right after Auth create.
      // Auth state can fire first — retry briefly before treating as orphan.
      let data = await getUserProfile(uid);
      if (!data) {
        for (const delayMs of [250, 500, 1000]) {
          if (requestId !== profileRequestRef.current) return;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          data = await getUserProfile(uid);
          if (data) break;
        }
      }
      if (requestId !== profileRequestRef.current) return;

      // Orphan Auth session (e.g. Firestore wiped): sign out so the app does
      // not sit in a half-authenticated state with permission-denied spam.
      if (!data) {
        if (__DEV__) {
          console.warn('[auth] No Firestore profile for uid; signing out', uid);
        }
        setProfile(null);
        setUser(null);
        await signOut(getFirebaseAuth());
        return;
      }

      setProfile(data);
    } catch (error) {
      if (__DEV__) console.warn('[auth] Failed to load profile', error);
      if (requestId === profileRequestRef.current) {
        setProfile(null);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfile(user.uid);
  }, [loadProfile, user]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser as AuthUser | null);
      if (nextUser) {
        void loadProfile(nextUser.uid);
      } else {
        profileRequestRef.current += 1;
        setProfile(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, [loadProfile]);

  const value = useMemo(
    () => ({ user, profile, isLoading, refreshProfile }),
    [user, profile, isLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
