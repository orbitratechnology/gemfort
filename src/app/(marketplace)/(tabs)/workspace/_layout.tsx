import { Stack } from 'expo-router';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';
import { useAuth } from '@/providers/auth-provider';

/**
 * Every workspace screen renders its own transparent in-screen header
 * (SafeAreaView + StackHeader), so the native stack header is hidden globally.
 */
export const unstable_settings = {
  /**
   * Keep the hub under nested screens for deep links and `withAnchor` navigations.
   * @see https://docs.expo.dev/router/basics/navigation/#initial-routes
   */
  anchor: 'index',
  initialRouteName: 'index',
};

export default function WorkspaceLayout() {
  const { colors } = useAppTheme();
  const { user } = useAuth();

  // Gate the whole stack (including deep links like /cheques) — no Redirect
  // (Fabric crash risk on Android nested tabs).
  if (!user) {
    return (
      <SignInPrompt
        title="Your workspace"
        message="Sign in to manage your private gem inventory, services, and finances."
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
