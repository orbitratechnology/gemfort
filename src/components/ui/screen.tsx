import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type ScreenProps = ScrollViewProps & {
  padded?: boolean;
  safeTop?: boolean;
};

/** Themed screen wrapper with consistent background and inset handling.
 * Default is unpadded so FormSections can be full-bleed; wrap copy/CTAs in ScreenInset. */
export function Screen({
  children,
  padded = false,
  safeTop = false,
  contentContainerStyle,
  style,
  ...props
}: ScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        padded && styles.padded,
        safeTop && { paddingTop: insets.top + Spacing.lg },
        contentContainerStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}

/** Themed ScrollView drop-in (replaces ScrollView + gray100 background) */
export function ThemedScrollView({ style, ...props }: ScrollViewProps) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentInsetAdjustmentBehavior="automatic"
      {...props}
    />
  );
}

/** Themed View drop-in for full-screen layouts */
export function ThemedView({ style, ...props }: ViewProps) {
  const { colors } = useAppTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]} {...props} />;
}

/** Non-scroll themed container for auth and modals */
export function ScreenView({
  children,
  padded = false,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: object;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: colors.background },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: {
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
});
