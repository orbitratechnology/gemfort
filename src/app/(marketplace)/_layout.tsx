import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';

/**
 * Action screens are siblings of `(tabs)` so they push above NativeTabs.
 * Nesting them inside a tab stack breaks dismiss / history on Android.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

const ACTION_SCREENS = [
  'gems/add',
  'bills/add',
  'cheques/add',
  'contacts/add',
  'ap/add',
  'services/add',
  'trips/add',
  'trips/[tripId]/add-purchase',
  'trips/[tripId]/add-expense',
  'trips/[tripId]/add-gems',
] as const;

export default function MarketplaceLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '600', color: colors.text },
          headerShadowVisible: false,
        }}
      />
      {ACTION_SCREENS.map((name) => (
        <Stack.Screen key={name} name={name} />
      ))}
    </Stack>
  );
}
