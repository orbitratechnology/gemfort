import { router } from "expo-router";
import { useState, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type HostInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScanSheet } from "@/components/scan/scan-sheet";
import { SHEET_CLOSE_MS } from "@/components/scan/scan-to-add-row";
import { ActionTile, ActionTileGrid } from "@/components/ui/action-tile";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/design-tokens";
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
  const [scanOpen, setScanOpen] = useState(false);

  const openCertificatePortals = () => {
    onClose();
    router.push("/verify-certificate-portals");
  };

  const openScanSheet = () => {
    onClose();
    // Let this sheet finish dismissing before presenting the next one.
    setTimeout(() => setScanOpen(true), SHEET_CLOSE_MS);
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
    <>
      <BottomSheet visible={visible} onClose={onClose} title="Quick actions">
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            Scan & verify
          </Text>
          <ActionTileGrid>
            <ActionTile
              label="List"
              accessibilityLabel="List verification portals"
              icon="list"
              accent={colors.onSurfaceVariant}
              onPress={openCertificatePortals}
            />
            <ActionTile
              label="Scan"
              hint="Scan a document or a certificate code"
              icon="document-scanner"
              accent={colors.primary}
              onPress={openScanSheet}
            />
          </ActionTileGrid>
        </View>

        {actions.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              Quick actions
            </Text>
            <ActionTileGrid>
              {actions.map((action) => (
                <ActionTile
                  key={action.id}
                  label={action.label}
                  icon={action.icon}
                  image={action.image}
                  accent={colors.primary}
                  onPress={() => selectAction(action)}
                />
              ))}
            </ActionTileGrid>
          </View>
        ) : null}
      </BottomSheet>
      <ScanSheet visible={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}

type QuickActionsFabProps = {
  onPress: () => void;
  targetRef?: RefObject<HostInstance | null>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function QuickActionsFab({
  onPress,
  targetRef,
  accessibilityLabel = "Open quick actions",
  accessibilityHint = "Add something or verify a certificate",
}: QuickActionsFabProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      ref={targetRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
