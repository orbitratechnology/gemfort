import { ScrollView, StyleSheet, Text, View } from "react-native";

import { BusinessCard } from "@/components/marketplace/business-card";
import { ElevatedCard } from "@/components/ui/elevated-card";
import { Icon } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Business } from "@/types";

type HomeBusinessRailProps = {
  businesses: Business[];
  emptyLabel: string;
  onBrowse: () => void;
  roleHint?: "Trader" | "Lapidary" | "Gem Lab";
};

/** Horizontal rail of the same BusinessCard used in directory / search. */
export function HomeBusinessRail({
  businesses,
  emptyLabel,
  onBrowse,
  roleHint,
}: HomeBusinessRailProps) {
  const { colors } = useAppTheme();

  if (!businesses.length) {
    return (
      <ElevatedCard
        accessibilityLabel={emptyLabel}
        onPress={onBrowse}
        style={styles.empty}
      >
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Icon name="storefront" size={18} color={colors.onPrimaryContainer} />
        </View>
        <Text
          style={[styles.emptyText, { color: colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {emptyLabel}
        </Text>
        <Icon name="chevron-right" size={18} color={colors.outline} />
      </ElevatedCard>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.rail}
    >
      {businesses.map((b) => (
        <BusinessCard
          key={b.id}
          business={b}
          href={`/business/${b.id}`}
          roleLabel={roleHint}
          style={styles.railCard}
        />
      ))}
    </ScrollView>
  );
}

const SHADOW_PAD = 12;

const styles = StyleSheet.create({
  list: {
    overflow: "visible",
  },
  rail: {
    gap: Spacing.stackMd,
    paddingHorizontal: Spacing.containerMargin,
    // Room for ElevatedCard shadows (ScrollView otherwise clips them)
    paddingVertical: SHADOW_PAD,
  },
  railCard: {
    width: 188,
    flex: 0,
  },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: Spacing.containerMargin,
    marginVertical: SHADOW_PAD,
    padding: 14,
    minHeight: 64,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { ...Typography.bodyMd, flex: 1 },
});
