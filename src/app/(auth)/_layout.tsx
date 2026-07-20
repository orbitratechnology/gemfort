import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';

export default function AuthLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerShown: true,
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account' }} />
      <Stack.Screen name="verify-otp" options={{ title: 'Verify Phone' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
    </Stack>
  );
}
