import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { warmUpFirestore } from '@/lib/firebase/init';
import { AuthProvider } from '@/providers/auth-provider';
import { PushNotificationRegistrar } from '@/providers/push-notification-registrar';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/** Matches expo-splash-screen plugin backgroundColor in app.config.ts */
const BOOT_BG = '#001618';

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
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(marketplace)" />
      <Stack.Screen name="business/[businessId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="listing/[slug]"
        options={{ headerShown: true, title: 'Listing', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="listings/create"
        options={{ headerShown: true, title: 'Create Listing', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="profile/verify" options={{ headerShown: false }} />
      <Stack.Screen name="profile/business" options={{ headerShown: false }} />
      <Stack.Screen name="profile/account" options={{ headerShown: false }} />
      <Stack.Screen name="request/[businessId]" options={{ headerShown: false }} />
      <Stack.Screen name="verify-certificate" options={{ headerShown: false }} />
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
      <ThemeProvider>
        <ToastProvider>
          <QueryProvider>
            <AuthProvider>
              <PushNotificationRegistrar />
              <RootNavigator />
            </AuthProvider>
          </QueryProvider>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    backgroundColor: BOOT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
