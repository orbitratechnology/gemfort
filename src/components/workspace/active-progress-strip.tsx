import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  buildActiveProgressItems,
  type ActiveProgressItem,
} from "@/features/workspace/active-progress";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { ApRecord, Cheque, Trip } from "@/types";

type ActiveProgressStripProps = {
  trips: Trip[];
  apRecords: ApRecord[];
  cheques: Cheque[];
  contactName: (id: string | null | undefined) => string;
  /** Max cards to show. */
  limit?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

function ProgressCard({
  item,
  compact,
}: {
  item: ActiveProgressItem;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const tone = item.overdue ? colors.error : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.badge}. ${item.title}. ${item.when}`}
      onPress={() => router.push(item.href as never)}
      style={({ pressed }) => [
        compact ? styles.compact : styles.card,
        {
          backgroundColor: pressed
            ? colors.surfaceContainerLow
            : colors.surfaceContainerLowest,
          borderColor: item.overdue ? colors.error + "44" : "transparent",
          borderWidth: item.overdue ? 1 : 0,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primaryContainer }]}>
        <Icon
          name={item.icon}
          size={compact ? 16 : 18}
          color={colors.onPrimaryContainer}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.badge, { color: tone }]} numberOfLines={1}>
            {item.badge}
          </Text>
          <Text
            style={[styles.name, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        <Text
          style={[styles.meta, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {item.subtitle}
        </Text>
        <View
          style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${item.progress}%`,
                backgroundColor: tone,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.when, { color: tone }]} numberOfLines={1}>
          {item.when}
        </Text>
        <Text
          style={[styles.date, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {item.dateLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export function ActiveProgressStrip({
  trips,
  apRecords,
  cheques,
  contactName,
  limit = 6,
  compact = false,
  style,
}: ActiveProgressStripProps) {
  const items = buildActiveProgressItems({
    trips,
    apRecords,
    cheques,
    contactName,
    limit,
  });

  if (items.length === 0) return null;

  return (
    <View style={[styles.list, style]}>
      {items.map((item) => (
        <ProgressCard key={item.id} item={item} compact={compact} />
      ))}
    </View>
  );
}

export type { ActiveProgressItem };

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  badge: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  name: {
    ...Typography.labelMd,
    fontWeight: "600",
    flexShrink: 1,
  },
  meta: { ...Typography.caption },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  fill: { height: "100%", borderRadius: 2 },
  right: {
    alignItems: "flex-end",
    gap: 2,
    maxWidth: 88,
  },
  when: {
    ...Typography.caption,
    fontWeight: "700",
  },
  date: {
    ...Typography.caption,
    fontSize: 11,
  },
});
