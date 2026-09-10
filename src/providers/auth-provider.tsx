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
import { doc, onSnapshot } from '@/lib/firebase/db';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase/config';
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
  const suspensionSignOutRef = useRef<string | null>(null);

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
        setProfile(null);
        setUser(null);
        await signOut(getFirebaseAuth());
        return;
      }

      if (data.isSuspended === true) {
        if (suspensionSignOutRef.current !== uid) {
          suspensionSignOutRef.current = uid;
          setProfile(null);
          setUser(null);
          await signOut(getFirebaseAuth());
        }
        return;
      }

      suspensionSignOutRef.current = null;
      setProfile(data);
    } catch {
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

    let unsubscribeProfile: (() => void) | null = null;
    const stopProfileListener = () => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
    };

    const unsub = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      stopProfileListener();
      setUser(nextUser as AuthUser | null);
      if (nextUser) {
        void loadProfile(nextUser.uid);
        unsubscribeProfile = onSnapshot(
          doc(getFirebaseDb(), 'users', nextUser.uid),
          (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            const nextProfile = { uid: nextUser.uid, ...data } as UserProfile;
            if (nextProfile.isSuspended === true) {
              if (suspensionSignOutRef.current === nextUser.uid) return;
              suspensionSignOutRef.current = nextUser.uid;
              profileRequestRef.current += 1;
              setProfile(null);
              setUser(null);
              void signOut(getFirebaseAuth()).catch(() => undefined);
              return;
            }

            suspensionSignOutRef.current = null;
            setProfile(nextProfile);
          },
          () => undefined,
        );
      } else {
        profileRequestRef.current += 1;
        suspensionSignOutRef.current = null;
        setProfile(null);
      }
      setIsLoading(false);
    });
    return () => {
      stopProfileListener();
      unsub();
    };
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
