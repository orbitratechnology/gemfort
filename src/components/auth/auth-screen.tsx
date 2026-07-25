import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedScrollView } from "@/components/ui/screen";
import { Spacing, TouchTarget, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type AuthScreenProps = {
  children: ReactNode;
  /** Top safe inset when the stack header is hidden. */
  safeTop?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Centered, keyboard-aware auth shell (popular-app login layout). */
export function AuthScreen({
  children,
  safeTop = false,
  contentContainerStyle,
}: AuthScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Bottom → top wash: richer glow at the base so content feels grounded / immersive.
  const wash = `
    linear-gradient(to top, ${colors.primary}16 0%, ${colors.background} 52%, ${colors.background} 100%),
    radial-gradient(ellipse 110% 70% at 50% 108%, ${colors.primaryContainer} 0%, transparent 58%),
    radial-gradient(circle at 0% 100%, ${colors.primary}12 0%, transparent 42%),
    radial-gradient(circle at 100% 100%, ${colors.primary}0E 0%, transparent 40%)
  `;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { experimental_backgroundImage: wash },
        ]}
      />
      <ThemedScrollView
        style={styles.scrollTransparent}
        contentContainerStyle={[
          styles.container,
          safeTop && { paddingTop: insets.top + Spacing.xxl },
          {
            paddingBottom:
              Math.max(insets.bottom, Spacing.md) + Spacing.section,
          },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ThemedScrollView>
    </View>
  );
}

/** Time-of-day greeting for auth entry. */
export function authGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type AuthHeadingProps = {
  /** Optional line above the title (e.g. time-of-day greeting). */
  greeting?: string;
  title: string;
  subtitle?: string;
};

/** Centered greeting + title + supporting line. */
export function AuthHeading({ greeting, title, subtitle }: AuthHeadingProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.heading}>
      {greeting ? (
        <Text style={[styles.greeting, { color: colors.primary }]}>
          {greeting}
        </Text>
      ) : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

type AuthFooterLinkProps = {
  href: Href;
  prompt: string;
  action: string;
};

/** “Don't have an account? Sign Up” footer. */
export function AuthFooterLink({ href, prompt, action }: AuthFooterLinkProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.footer}>
      <Text style={[styles.prompt, { color: colors.textMuted }]}>
        {prompt}{" "}
      </Text>
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={action}
          style={({ pressed }) => [
            styles.actionHit,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.action, { color: colors.primary }]}>
            {action}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollTransparent: { backgroundColor: "transparent" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.xl,
  },
  heading: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.sm,
  },
  greeting: {
    ...Typography.labelMd,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    ...Typography.story,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.bodyLarge,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    minHeight: TouchTarget.minHeight,
    paddingTop: Spacing.sm,
  },
  prompt: {
    ...Typography.bodyMd,
    textAlign: "center",
  },
  actionHit: {
    minHeight: TouchTarget.minHeight,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  action: {
    ...Typography.bodyMd,
    fontWeight: "700",
  },
});
