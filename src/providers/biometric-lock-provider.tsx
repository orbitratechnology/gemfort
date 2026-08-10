import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as React from "react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, BackHandler, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { Button } from "@/components/ui/button";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  isExternalActivityActive,
  subscribeToExternalActivity,
} from "@/lib/app-lifecycle/external-activity";
import { haptics } from "@/lib/haptics";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAuth } from "@/providers/auth-provider";

const KEY_PREFIX = "gemfort.biometric-lock.";
const UNLOCKED_AT_PREFIX = "gemfort.biometric-unlocked-at.";
export const BIOMETRIC_GRACE_PERIOD_MS = 60_000;

type BiometricLockContextValue = {
  available: boolean;
  enabled: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  methodLabel: string;
  setEnabled: (next: boolean) => Promise<void>;
};

const BiometricLockContext =
  React.createContext<BiometricLockContextValue | null>(null);

function storageKey(uid: string) {
  return `${KEY_PREFIX}${uid}`;
}

function unlockedAtKey(uid: string) {
  return `${UNLOCKED_AT_PREFIX}${uid}`;
}

function methodLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Fingerprint";
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "Iris scan";
  return "Biometrics";
}

async function getAvailability() {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return {
    available: hasHardware && isEnrolled && types.length > 0,
    label: methodLabel(types),
  };
}

function isWithinGracePeriod(unlockedAt: number | null) {
  return unlockedAt != null && Date.now() - unlockedAt < BIOMETRIC_GRACE_PERIOD_MS;
}

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [locked, setLocked] = useState(false);
  const [method, setMethod] = useState("Biometrics");
  const [externalActivityActive, setExternalActivityActive] = useState(
    isExternalActivityActive(),
  );
  const appStateRef = useRef(AppState.currentState);
  const unlockedAtRef = useRef<number | null>(null);
  const authPromiseRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  const persistUnlock = useCallback(async (uid: string) => {
    const timestamp = Date.now();
    unlockedAtRef.current = timestamp;
    await SecureStore.setItemAsync(unlockedAtKey(uid), String(timestamp));
  }, []);

  const authenticate = useCallback(async (canAuthenticate = available) => {
    if (
      !canAuthenticate ||
      !user ||
      authPromiseRef.current ||
      AppState.currentState !== "active" ||
      isExternalActivityActive()
    ) {
      return false;
    }

    const promise = (async () => {
      if (mountedRef.current) {
        setLocked(true);
        setIsAuthenticating(true);
      }
      try {
        const result = await LocalAuthentication.authenticateAsync({
          biometricsSecurityLevel: "strong",
          promptMessage: "Unlock GemFort",
          promptDescription: "Verify your identity to continue.",
          promptSubtitle: "Your account stays protected on this device.",
          cancelLabel: "Cancel",
          requireConfirmation: true,
        });
        if (!result.success) return false;
        await persistUnlock(user.uid);
        if (mountedRef.current) setLocked(false);
        return true;
      } catch {
        return false;
      } finally {
        if (mountedRef.current) setIsAuthenticating(false);
        authPromiseRef.current = null;
      }
    })();

    authPromiseRef.current = promise;
    return promise;
  }, [available, persistUnlock, user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => subscribeToExternalActivity(setExternalActivityActive), []);

  useEffect(() => {
    let cancelled = false;
    unlockedAtRef.current = null;

    async function loadPreference() {
      setIsLoading(true);
      setLocked(false);
      setEnabledState(false);
      setAvailable(false);
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const [capability, stored, storedUnlockedAt] = await Promise.all([
          getAvailability(),
          SecureStore.getItemAsync(storageKey(user.uid)),
          SecureStore.getItemAsync(unlockedAtKey(user.uid)),
        ]);
        if (cancelled) return;
        const parsed = storedUnlockedAt ? Number(storedUnlockedAt) : NaN;
        const lastUnlockedAt = Number.isFinite(parsed) ? parsed : null;
        unlockedAtRef.current = lastUnlockedAt;
        setAvailable(capability.available);
        setMethod(capability.label);
        setEnabledState(stored === "1");
        setLocked(stored === "1" && capability.available && !isWithinGracePeriod(lastUnlockedAt));
      } catch {
        if (!cancelled) {
          setAvailable(false);
          setEnabledState(false);
          setLocked(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (
      isLoading ||
      !enabled ||
      !available ||
      !user ||
      externalActivityActive ||
      !locked
    ) {
      return;
    }
    void authenticate();
  }, [authenticate, available, enabled, externalActivityActive, isLoading, locked, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (!enabled || !user || isExternalActivityActive()) return;

      if (nextState !== "active") {
        return;
      }

      if (previousState === "active") return;
      if (isWithinGracePeriod(unlockedAtRef.current)) {
        setLocked(false);
        return;
      }
      setLocked(true);
    });
    return () => subscription.remove();
  }, [enabled, externalActivityActive, user]);

  useEffect(() => {
    if (!locked) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [locked]);

  async function setEnabled(next: boolean) {
    if (!user) return;
    if (!next) {
      await Promise.all([
        SecureStore.deleteItemAsync(storageKey(user.uid)),
        SecureStore.deleteItemAsync(unlockedAtKey(user.uid)),
      ]);
      unlockedAtRef.current = null;
      setEnabledState(false);
      setLocked(false);
      return;
    }

    const capability = await getAvailability();
    setAvailable(capability.available);
    setMethod(capability.label);
    if (!capability.available) {
      throw new Error("Set up Face ID or fingerprint in your device settings first.");
    }

    const authenticated = await authenticate(capability.available);
    if (!authenticated) throw new Error("Biometric unlock was cancelled.");
    await SecureStore.setItemAsync(storageKey(user.uid), "1");
    setEnabledState(true);
    setLocked(false);
  }

  const value: BiometricLockContextValue = {
    available,
    enabled,
    isLoading,
    isAuthenticating,
    methodLabel: method,
    setEnabled,
  };

  return (
    <BiometricLockContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {user && enabled && locked ? (
          <View style={[styles.lock, { backgroundColor: colors.background }]}>
            <Image source={require("@/assets/images/logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="GemFort logo" />
            <Text style={[styles.title, { color: colors.text }]}>GemFort is locked</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {isAuthenticating ? `Confirm with ${method} to continue.` : "Use your device security to access your account."}
            </Text>
            <Button
              title={isAuthenticating ? "Waiting for verification" : "Unlock GemFort"}
              icon="fingerprint"
              loading={isAuthenticating}
              onPress={() => {
                haptics.play("light");
                void authenticate();
              }}
              style={styles.unlock}
            />
          </View>
        ) : null}
      </View>
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock() {
  const context = React.useContext(BiometricLockContext);
  if (!context) throw new Error("useBiometricLock must be used within BiometricLockProvider");
  return context;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  lock: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: Spacing.xxxl, zIndex: 10 },
  logo: { width: 96, height: 96, marginBottom: Spacing.xxl },
  title: { ...Typography.headlineMd, textAlign: "center" },
  message: { ...Typography.bodyLg, textAlign: "center", maxWidth: 300, marginTop: Spacing.sm },
  unlock: { minWidth: 220, marginTop: Spacing.xxl, borderRadius: Radius.full },
});
