import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export type QuickActionSheetItem = {
  id: string;
  label: string;
  icon: IconName;
  image?: number;
  href: string;
};

type QuickActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  actions: QuickActionSheetItem[];
  onActionPress?: (action: QuickActionSheetItem) => void;
};

export function QuickActionsSheet({
  visible,
  onClose,
  actions,
  onActionPress,
}: QuickActionsSheetProps) {
  const { colors } = useAppTheme();

  const openCertificatePortals = () => {
    onClose();
    router.push("/verify-certificate-portals");
  };

  const scanCertificate = () => {
    onClose();
    router.push("/scan-certificate");
  };

  const selectAction = (action: QuickActionSheetItem) => {
    onClose();
    if (onActionPress) {
      onActionPress(action);
      return;
    }
    router.push(action.href as never);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Quick actions">
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          Verify certificate
        </Text>
        <View style={styles.verifyOptions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="List verification portals"
            onPress={openCertificatePortals}
            style={({ pressed }) => [
              styles.verifyOption,
              { backgroundColor: colors.surfaceContainerLow },
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View
              style={[
                styles.verifyOptionIcon,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Icon name="list" size={24} color={colors.primary} />
            </View>
            <Text
              style={[styles.optionTitle, { color: colors.onSurface }]}
            >
              List
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan certificate"
            onPress={scanCertificate}
            style={({ pressed }) => [
              styles.verifyOption,
              { backgroundColor: colors.surfaceContainerLow },
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <View
              style={[
                styles.verifyOptionIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon name="qr-code-scanner" size={24} color={colors.primary} />
            </View>
            <Text
              style={[styles.optionTitle, { color: colors.onSurface }]}
            >
              Scan
            </Text>
          </Pressable>
        </View>
      </View>

      {actions.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            Quick actions
          </Text>
          <View style={styles.actionGrid}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => selectAction(action)}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: colors.surfaceContainerLow },
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    !action.image && { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  {action.image ? (
                    <Image
                      source={action.image}
                      style={styles.actionImage}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Icon
                      name={action.icon}
                      size={22}
                      color={colors.onPrimaryContainer}
                    />
                  )}
                </View>
                <Text
                  style={[styles.optionTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

type QuickActionsFabProps = {
  onPress: () => void;
};

export function QuickActionsFab({ onPress }: QuickActionsFabProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open quick actions"
      accessibilityHint="Add something or verify a certificate"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          bottom: Math.max(insets.bottom, 12),
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Icon name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  verifyOptions: { flexDirection: "row", gap: Spacing.md },
  verifyOption: {
    flex: 1,
    minHeight: 88,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  verifyOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  action: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 76,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  actionImage: { width: 42, height: 42 },
  optionTitle: { ...Typography.bodyMd, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: Spacing.containerMargin,
    bottom: 12,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    boxShadow: "0 5px 16px rgba(0, 0, 0, 0.2)",
  },
});
