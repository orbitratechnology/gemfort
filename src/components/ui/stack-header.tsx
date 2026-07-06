import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type StackHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Use 'close' (x) instead of back arrow. */
  closeIcon?: boolean;
  /** Hide the back/close button (for top-level tab roots). Defaults to true. */
  showBack?: boolean;
};

/** Transparent, no-elevation stack header consistent across the app. */
export function StackHeader({ title, onBack, right, closeIcon, showBack = true }: StackHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={closeIcon ? 'Close' : 'Go back'}>
          <Icon name={closeIcon ? 'close' : 'arrow-back'} size={24} color={colors.onSurface} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
      <Text style={[styles.title, { color: colors.primary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.iconBtn}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.headlineMdMobile, flex: 1, textAlign: 'center' },
});
