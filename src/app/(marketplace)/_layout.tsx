import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import {
  formSheetScreenOptions,
  silkStackScreenOptions,
} from '@/navigation/silk-stack-options';

/**
 * Action sheets are siblings of `(tabs)` so formSheet presents above NativeTabs.
 * Nesting formSheet inside a tab stack breaks dismiss / history on Android.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

const ACTION_SHEETS = [
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
  const sheetOptions = {
    ...formSheetScreenOptions,
    contentStyle: { backgroundColor: colors.background },
  };

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
      {ACTION_SHEETS.map((name) => (
        <Stack.Screen key={name} name={name} options={sheetOptions} />
      ))}
    </Stack>
  );
}
