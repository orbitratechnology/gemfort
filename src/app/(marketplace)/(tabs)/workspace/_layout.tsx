import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';

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
