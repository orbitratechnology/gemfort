import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * One quiet line under a form while a scan is read on device, then what it
 * filled in. Renders nothing before a scan.
 */
export function ScanFillStatus({
  reading,
  filled,
  document,
  style,
}: {
  reading: boolean;
  /** Labels of fields filled from the last scan; null before any scan was read. */
  filled: string[] | null;
  /** "cheque", "bill", "receipt". */
  document: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  if (!reading && filled === null) return null;

  const message = reading
    ? `Reading ${document}…`
    : filled?.length
      ? `Filled ${list(filled)} from the scan. Check before saving.`
      : `Couldn't read details from this ${document}.`;

  return (
    <View style={[styles.row, style]} accessibilityLiveRegion="polite" accessibilityRole="text">
      {reading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Icon
          name={filled?.length ? 'document-scanner' : 'info'}
          size={16}
          color={filled?.length ? colors.primary : colors.textMuted}
        />
      )}
      <Text style={[styles.text, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
  },
  text: { flex: 1, fontFamily: FontFamily.regular, fontSize: 13, includeFontPadding: false },
});
