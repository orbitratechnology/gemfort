import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';

/**
 * Every workspace screen renders its own transparent in-screen header
 * (SafeAreaView + StackHeader), so the native stack header is hidden globally.
 */
export const unstable_settings = {
  /** Deep links (notifications) keep a back target to the workspace hub. */
  anchor: 'index',
};

export default function WorkspaceLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
