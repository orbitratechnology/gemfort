import { useAppTheme } from "@/hooks/use-app-theme";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { warmUpFirestore } from "@/lib/firebase/init";
import { silkStackScreenOptions } from "@/navigation/silk-stack-options";
import { AuthProvider } from "@/providers/auth-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { PushNotificationRegistrar } from "@/providers/push-notification-registrar";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
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

function RootNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: "600", color: colors.text },
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
      <Stack.Screen
        name="request/[businessId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="handle-share" options={{ headerShown: false }} />
      <Stack.Screen
        name="verify-certificate"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="news/index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [firebaseReady, setFirebaseReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      void SplashScreen.hideAsync();
      return;
    }

    let cancelled = false;
    void warmUpFirestore()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setFirebaseReady(true);
          void SplashScreen.hideAsync();
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!firebaseReady) {
    return <BootPlaceholder />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <QueryProvider>
                <AuthProvider>
                  <PushNotificationRegistrar />
                  <RootNavigator />
                  <KeyboardToolbar />
                </AuthProvider>
              </QueryProvider>
            </ConfirmProvider>
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
});
