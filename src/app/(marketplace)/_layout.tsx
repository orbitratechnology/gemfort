import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/use-app-theme';
import { silkStackScreenOptions } from '@/navigation/silk-stack-options';

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
    </Stack>
  );
}
