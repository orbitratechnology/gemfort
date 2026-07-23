import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';

/**
 * Every money screen renders its own transparent in-screen header
 * (SafeAreaView + StackHeader), so the native stack header is hidden globally.
 */
export const unstable_settings = {
  /** Deep links keep a back target to the money dashboard. */
  anchor: 'index',
};

export default function MoneyLayout() {
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
