import { Stack } from 'expo-router';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';
import { useAuth } from '@/providers/auth-provider';

/**
 * Every money screen renders its own transparent in-screen header
 * (SafeAreaView + StackHeader), so the native stack header is hidden globally.
 */
export const unstable_settings = {
  /**
   * Keep the money hub under nested screens for deep links and `withAnchor`.
   * @see https://docs.expo.dev/router/basics/navigation/#initial-routes
   */
  anchor: 'index',
  initialRouteName: 'index',
};

export default function MoneyLayout() {
  const { colors } = useAppTheme();
  const { user } = useAuth();

  if (!user) {
    return (
      <SignInPrompt
        title="Your money"
        message="Sign in to track income, expenses, receivables, and payables."
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
