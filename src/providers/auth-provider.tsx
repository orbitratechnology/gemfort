import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged } from '@/lib/firebase/auth';
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

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const data = await getUserProfile(user.uid);
    setProfile(data);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onAuthStateChanged(getFirebaseAuth(), async (nextUser) => {
      setUser(nextUser as AuthUser | null);
      if (nextUser) {
        const data = await getUserProfile(nextUser.uid);
        setProfile(data);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

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
