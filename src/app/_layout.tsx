import { useAppTheme } from '@/hooks/use-app-theme';
import { AuthProvider } from '@/providers/auth-provider';
import { PushNotificationRegistrar } from '@/providers/push-notification-registrar';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

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
      <Stack.Screen
        name="profile/business"
        options={{ headerShown: true, title: 'My Business', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="notifications"
        options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Back' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
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
  );
}
