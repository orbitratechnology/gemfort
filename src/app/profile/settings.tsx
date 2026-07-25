import { Redirect, router, type Href } from "expo-router";
import { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormSection, FormSectionLabel } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Spacing, Typography, type ThemeColors } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import {
  updateFcmToken,
  updateNotificationPreferences,
} from "@/lib/firebase/auth-service";
import { registerPushTokenForUser } from "@/lib/notifications/register-push-token";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const TERMS_URL = "https://gemfort.app/terms";
const PRIVACY_URL = "https://gemfort.app/privacy";
const SUPPORT_EMAIL = "mailto:support@gemfort.app";

function Divider({ colors }: { colors: ThemeColors }) {
  return (
    <View
      style={[styles.divider, { backgroundColor: colors.surfaceVariant }]}
    />
  );
}

function Row({
  icon,
  label,
  subtitle,
  onPress,
  trailing,
  danger,
  colors,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { opacity: 0.7 } : null,
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon
          name={icon}
          size={20}
          color={danger ? colors.error : colors.primary}
        />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowLabel,
            { color: danger ? colors.error : colors.textMain },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Icon name="chevron-right" size={20} color={colors.outline} />
        ) : null)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [togglingPush, setTogglingPush] = useState(false);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const pushEnabled = profile?.notificationPreferences?.pushEnabled !== false;

  async function handlePushToggle(next: boolean) {
    if (!user || togglingPush) return;
    setTogglingPush(true);
    try {
      const nextPrefs = {
        ...(profile?.notificationPreferences ?? {}),
        pushEnabled: next,
      };
      await updateNotificationPreferences(user.uid, nextPrefs);
      if (next) {
        await registerPushTokenForUser(user.uid);
      } else {
        await updateFcmToken(user.uid, null);
      }
      await refreshProfile();
      toast.success(next ? "Notifications enabled." : "Notifications disabled.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update notification settings."));
    } finally {
      setTogglingPush(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Settings" />
      <ThemedScrollView contentContainerStyle={styles.container}>
        <FormSectionLabel title="NOTIFICATIONS" />
        <FormSection padded={false}>
          <Row
            colors={colors}
            icon="notifications"
            label="Push notifications"
            subtitle={
              pushEnabled
                ? "Alerts for cheques, bills, and announcements"
                : "All push alerts are off"
            }
            trailing={
              <Switch
                value={pushEnabled}
                onValueChange={(v) => void handlePushToggle(v)}
                disabled={togglingPush}
                trackColor={{
                  false: colors.outlineVariant,
                  true: colors.primaryMuted,
                }}
                thumbColor={pushEnabled ? colors.primary : colors.surface}
                ios_backgroundColor={colors.outlineVariant}
              />
            }
          />
        </FormSection>

        <FormSectionLabel title="ACCOUNT" />
        <FormSection padded={false}>
          <Row
            colors={colors}
            icon="manage-accounts"
            label="Account settings"
            subtitle="Password & security"
            onPress={() => router.push("/profile/account" as Href)}
          />
          <Divider colors={colors} />
          <Row
            colors={colors}
            icon="delete-forever"
            label="Delete account"
            subtitle="Permanently remove your data"
            danger
            onPress={() => router.push("/profile/account" as Href)}
          />
        </FormSection>

        <FormSectionLabel title="LEGAL & SUPPORT" />
        <FormSection padded={false}>
          <Row
            colors={colors}
            icon="description"
            label="Terms & Conditions"
            onPress={() => void Linking.openURL(TERMS_URL)}
          />
          <Divider colors={colors} />
          <Row
            colors={colors}
            icon="policy"
            label="Privacy Policy"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
          <Divider colors={colors} />
          <Row
            colors={colors}
            icon="help-outline"
            label="Support"
            subtitle="support@gemfort.app"
            onPress={() => void Linking.openURL(SUPPORT_EMAIL)}
          />
        </FormSection>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.section,
    gap: Spacing.stackMd,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.gutterMd,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { ...Typography.bodyLg, fontWeight: "600" },
  rowSub: { ...Typography.bodyMd, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
});
