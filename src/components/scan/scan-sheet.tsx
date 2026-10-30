import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScanToAddRow } from '@/components/scan/scan-to-add-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type ScanSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Every camera entry point: scan a document to add it, or a certificate code to verify it. */
export function ScanSheet({ visible, onClose }: ScanSheetProps) {
  const { colors } = useAppTheme();

  const scanCertificate = () => {
    onClose();
    router.push('/scan-certificate');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Scan">
      <ScanToAddRow
        onBeforeCapture={onClose}
        header={<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Scan & add</Text>}
        style={styles.section}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Verify certificate</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan certificate QR or barcode"
          accessibilityHint="Opens the lab's verification report"
          onPress={scanCertificate}
          style={({ pressed }) => [
            styles.option,
            { backgroundColor: colors.surfaceContainerLow },
            { opacity: pressed ? 0.72 : 1 },
          ]}>
          <View style={[styles.optionIcon, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="qr-code-scanner" size={24} color={colors.primary} />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: colors.onSurface }]}>Certificate QR / Barcode</Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]} numberOfLines={1}>
              Open the lab report from the code
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  option: {
    minHeight: 72,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { ...Typography.bodyMd, fontWeight: '700' },
  optionHint: { ...Typography.labelMd },
});
