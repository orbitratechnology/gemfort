import { Stack } from "expo-router";

import { FontFamily } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { silkStackScreenOptions } from "@/navigation/silk-stack-options";

export default function SearchLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        ...silkStackScreenOptions,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: FontFamily.semibold,
          fontWeight: "600",
          color: colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Search" }} />
    </Stack>
  );
}
