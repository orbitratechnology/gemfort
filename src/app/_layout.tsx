import { FontFamily } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { warmUpFirestore } from "@/lib/firebase/init";
// Side-effect: register background notification task at module load.
import "@/lib/notifications/rich-display";
import {
  formSheetFitContentOptions,
  formSheetScreenOptions,
  silkStackScreenOptions,
} from "@/navigation/silk-stack-options";
import { AuthProvider } from "@/providers/auth-provider";
import { BiometricLockProvider } from "@/providers/biometric-lock-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { LoadingProvider } from "@/providers/loading-provider";
import { PushNotificationRegistrar } from "@/providers/push-notification-registrar";
import { QuickActionsRegistrar } from "@/providers/quick-actions-registrar";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  KeyboardProvider,
  KeyboardToolbar,
} from "react-native-keyboard-controller";

/** Matches expo-splash-screen plugin backgroundColor in app.config.ts */
const BOOT_BG = "#000000";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

function BootPlaceholder() {
  return (
    <View style={styles.boot} accessibilityLabel="Loading GemFort">
      <ActivityIndicator color="#FFFFFF" size="large" />
    </View>
  );
}

/** Keeps unexpected rendering failures understandable and free of diagnostics. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>Please try again.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={() => void retry()}
        style={({ pressed }) => [styles.retryButton, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

function RootNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: FontFamily.semibold,
          fontWeight: "600",
          color: colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(marketplace)" />
      <Stack.Screen
        name="business/[businessId]"
        options={{ headerShown: false }}
      />
      {/* headerShown false: Apple Zoom conflicts with native headers */}
      <Stack.Screen name="listing/[slug]" options={{ headerShown: false }} />
      <Stack.Screen
        name="listings/create"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="profile/verify" options={{ headerShown: false }} />
      <Stack.Screen name="profile/business" options={{ headerShown: false }} />
      <Stack.Screen name="profile/account" options={{ headerShown: false }} />
      <Stack.Screen name="profile/settings" options={{ headerShown: false }} />
      <Stack.Screen
        name="request/[businessId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="handle-share" options={{ headerShown: false }} />
      <Stack.Screen
        name="verify-certificate"
        options={{
          ...formSheetFitContentOptions,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="verify-certificate-portals"
        options={{
          ...formSheetScreenOptions,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen name="news/index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [firebaseReady, setFirebaseReady] = useState(!isFirebaseConfigured);
  const fontsReady = fontsLoaded || fontError != null;

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    let cancelled = false;
    void warmUpFirestore()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setFirebaseReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsReady && firebaseReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady, firebaseReady]);

  if (!fontsReady || !firebaseReady) {
    return <BootPlaceholder />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <ThemeProvider>
          <ToastProvider>
            <LoadingProvider>
              <ConfirmProvider>
                <QueryProvider>
                  <AuthProvider>
                    <BiometricLockProvider>
                      <PushNotificationRegistrar />
                      <QuickActionsRegistrar />
                      <RootNavigator />
                      <KeyboardToolbar />
                    </BiometricLockProvider>
                  </AuthProvider>
                </QueryProvider>
              </ConfirmProvider>
            </LoadingProvider>
          </ToastProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    backgroundColor: BOOT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  errorScreen: {
    flex: 1,
    backgroundColor: BOOT_BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  errorTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  errorMessage: { color: "#D1D1D1", fontSize: 16 },
  retryButton: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryLabel: { color: "#171717", fontSize: 16, fontWeight: "600" },
});
