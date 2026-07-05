import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';

/**
 * Screens that render their own in-screen transparent header (SafeAreaView +
 * glass top bar) must hide the native stack header to avoid duplicates.
 */
const SELF_HEADERED = [
  'index',
  'gems/index',
  'gems/add',
  'gems/[gemId]',
  'ap/index',
  'ap/[apId]',
  'money/index',
  'money/transactions',
  'services/index',
  'services/[serviceId]',
  'contacts/index',
  'money/record-sale',
];

export default function WorkspaceLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Back',
      }}>
      {/* Self-headered (redesigned) screens */}
      {SELF_HEADERED.map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}

      {/* Native-headered (flat, no elevation) screens */}
      <Stack.Screen name="services/add" options={{ title: 'Add Service' }} />
      <Stack.Screen name="ap/add" options={{ title: 'Give on AP' }} />
      <Stack.Screen name="money/receivables" options={{ title: 'Receivables' }} />
      <Stack.Screen name="money/payables" options={{ title: 'Payables' }} />
      <Stack.Screen name="contacts/add" options={{ title: 'Add Contact' }} />
      <Stack.Screen name="contacts/[contactId]" options={{ title: 'Contact' }} />
    </Stack>
  );
}
