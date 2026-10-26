import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export type GemActionGroup = "work" | "trade";

export type GemActionItem = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  image?: number;
  group: GemActionGroup;
  destructive?: boolean;
  onPress: () => void;
};

const GROUPS: { id: GemActionGroup; label: string }[] = [
  { id: "work", label: "Send for work" },
  { id: "trade", label: "Sell or lend" },
];

type GemActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  actions: GemActionItem[];
};

/** Owner actions for a workspace gem, grouped by what happens to the stone. */
export function GemActionsSheet({ visible, onClose, actions }: GemActionsSheetProps) {
  const { colors } = useAppTheme();

  const selectAction = (action: GemActionItem) => {
    onClose();
    // Defer so the sheet starts dismissing before a route or dialog opens.
    requestAnimationFrame(() => action.onPress());
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Gem actions" fitToContents>
      {GROUPS.map((group) => {
        const items = actions.filter((action) => action.group === group.id);
        if (items.length === 0) return null;
        return (
          <View key={group.id} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {group.label}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
              {items.map((action, index) => {
                const tint = action.destructive ? colors.error : colors.onSurface;
                return (
                  <Pressable
                    key={action.id}
                    accessibilityRole="button"
                    accessibilityLabel={action.title}
                    accessibilityHint={action.description}
                    onPress={() => selectAction(action)}
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.outlineVariant,
                      },
                      pressed && { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconTile,
                        !action.image && {
                          backgroundColor: action.destructive
                            ? colors.errorContainer
                            : colors.primaryContainer,
                        },
                      ]}
                    >
                      {action.image ? (
                        <Image
                          source={action.image}
                          style={styles.iconImage}
                          contentFit="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <Icon
                          name={action.icon}
                          size={22}
                          color={
                            action.destructive
                              ? colors.onErrorContainer
                              : colors.onPrimaryContainer
                          }
                        />
                      )}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: tint }]} numberOfLines={1}>
                        {action.title}
                      </Text>
                      <Text
                        style={[styles.rowDescription, { color: colors.textMuted }]}
                        numberOfLines={2}
                      >
                        {action.description}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={colors.outline} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  card: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: { width: 42, height: 42 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.bodyMd, fontWeight: "700" },
  rowDescription: { ...Typography.bodySmall },
});
