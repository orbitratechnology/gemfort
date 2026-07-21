import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { COVER_BANNER_HEIGHT, CoverBanner } from "@/components/ui/cover-banner";
import { CurrencyPickerSheet } from "@/components/ui/currency-picker-sheet";
import { FormSection, FormSectionLabel } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import {
    getCurrencyLabel,
    type CurrencyCode,
} from "@/constants/currencies";
import {
    Radius,
    Spacing,
    Typography,
    type ThemeColors,
} from "@/constants/design-tokens";
import {
    ROLE_LABELS,
    isVerifiedRole,
    resolveProfileRole,
} from "@/constants/roles";
import { fetchBusinessByOwnerUid } from "@/features/marketplace/marketplace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { alert } from "@/lib/alert";
import {
    logoutUser,
    updatePreferredCurrency,
} from "@/lib/firebase/auth-service";
import { friendlyError } from "@/lib/errors";
import type { ThemePreference } from "@/lib/theme-preference";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const themeOptions: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: "system", label: "System", icon: "brightness-auto" },
  { id: "light", label: "Light", icon: "light-mode" },
  { id: "dark", label: "Dark", icon: "dark-mode" },
];

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
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.rowIcon]}>
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
      {trailing ?? (
        <Icon name="chevron-right" size={20} color={colors.outline} />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors, preference, setPreference } = useAppTheme();
  const preferredCurrency = usePreferredCurrency();
  const toast = useToast();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const { data: business } = useQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  if (!user) {
    return (
      <SignInPrompt
        title="Your Profile"
        message="Sign in to manage your account, verification, and listings."
      />
    );
  }

  async function handleLogout() {
    await logoutUser();
    router.replace("/(marketplace)/(tabs)/home");
  }

  async function handleCurrencySelect(code: CurrencyCode) {
    if (!user || code === preferredCurrency || savingCurrency) return;
    setSavingCurrency(true);
    try {
      await updatePreferredCurrency(user.uid, code);
      await refreshProfile();
      toast.success(`Display currency set to ${code}`);
    } catch (e) {
      toast.error(friendlyError(e, "Could not update currency."));
    } finally {
      setSavingCurrency(false);
    }
  }

  const effectiveRole = resolveProfileRole(profile);
  const isVerified = profile?.verificationStatus === "verified";
  const isVerifiedTrader = isVerifiedRole(profile, "trader");
  const initial = (profile?.displayName ?? "?").charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[effectiveRole] ?? "Member";
  const memberYear = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getFullYear()
    : new Date().getFullYear();
  const coverUri = business?.coverPhotoUrl ?? null;
  const avatarUri = business?.logoUrl ?? null;

  return (
    <SafeAreaView
      collapsable={false}
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Edge-to-edge cover + identity */}
        <View style={styles.hero}>
          <CoverBanner uri={coverUri} height={COVER_BANNER_HEIGHT} />
          <View style={styles.identity}>
            <View style={styles.avatarWrap}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.primaryMuted,
                    borderColor: colors.background,
                  },
                ]}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text
                    style={[styles.avatarInitial, { color: colors.primary }]}
                  >
                    {initial}
                  </Text>
                )}
              </View>
              {isVerified ? (
                <View
                  style={[
                    styles.verifiedDot,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.background,
                    },
                  ]}
                >
                  <Icon name="verified" size={16} color={colors.onSecondary} />
                </View>
              ) : null}
            </View>
            <Text style={[styles.name, { color: colors.primary }]}>
              {profile?.displayName}
            </Text>
            <View style={styles.roleRow}>
              <Text style={[styles.role, { color: colors.onSurfaceVariant }]}>
                {roleLabel}
              </Text>
            </View>
            <Text style={[styles.memberSince, { color: colors.textMuted }]}>
              MEMBER SINCE {memberYear}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <FormSectionLabel title="BUSINESS PROFILE" />
          <FormSection padded={false}>
            {!isVerified ? (
              <>
                <Row
                  colors={colors}
                  icon="verified-user"
                  label="Verification Status"
                  subtitle="Not verified yet"
                  onPress={() => router.push("/profile/verify")}
                  trailing={
                    <Text
                      style={[
                        styles.trailingValue,
                        { color: colors.warningAmber },
                      ]}
                    >
                      Pending
                    </Text>
                  }
                />
                <Divider colors={colors} />
              </>
            ) : null}
            <Row
              colors={colors}
              icon="storefront"
              label="Edit Business"
              subtitle="Update contact & info"
              onPress={() => router.push("/profile/business" as Href)}
            />
            {isVerifiedTrader ? (
              <>
                <Divider colors={colors} />
                <Row
                  colors={colors}
                  icon="visibility"
                  label="View Public Shop"
                  subtitle="See customer preview"
                  onPress={() => router.push("/profile/business" as Href)}
                />
              </>
            ) : null}
          </FormSection>

          <FormSectionLabel title="APPEARANCE" />
          <FormSection>
            <View
              style={[
                styles.segment,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              {themeOptions.map((option) => {
                const active = preference === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setPreference(option.id)}
                    style={[
                      styles.segmentBtn,
                      active && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Icon
                      name={option.icon}
                      size={16}
                      color={
                        active ? colors.onPrimary : colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: active
                            ? colors.onPrimary
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormSection>

          <FormSectionLabel title="PREFERENCES" />
          <FormSection padded={false}>
            <Row
              colors={colors}
              icon="payments"
              label="Preferred currency"
              subtitle={`${preferredCurrency} · ${getCurrencyLabel(preferredCurrency)}`}
              onPress={() => setCurrencyPickerOpen(true)}
              trailing={
                <Text
                  style={[styles.trailingValue, { color: colors.textMuted }]}
                >
                  {preferredCurrency}
                </Text>
              }
            />
          </FormSection>

          <FormSectionLabel title="ACCOUNT & APP" />
          <FormSection padded={false}>
            <Row
              colors={colors}
              icon="manage-accounts"
              label="Account settings"
              subtitle="Password & delete account"
              onPress={() => router.push("/profile/account" as Href)}
            />
            <Divider colors={colors} />
            <Row
              colors={colors}
              icon="help-outline"
              label="Help Center"
              onPress={() => Linking.openURL("mailto:support@gemfort.app")}
            />
            <Divider colors={colors} />
            <Row
              colors={colors}
              icon="info-outline"
              label="About GemFort"
              trailing={
                <Text
                  style={[styles.trailingValue, { color: colors.textMuted }]}
                >
                  v1.0.0
                </Text>
              }
            />
          </FormSection>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log Out"
            onPress={() =>
              alert("Sign out?", "You can sign back in anytime.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Log Out",
                  style: "destructive",
                  onPress: handleLogout,
                },
              ])
            }
            style={({ pressed }) => [
              styles.logout,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Icon name="logout" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Log Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <CurrencyPickerSheet
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        value={preferredCurrency}
        onSelect={(code) => {
          setCurrencyPickerOpen(false);
          void handleCurrencySelect(code);
        }}
        title="Preferred currency"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { ...Typography.headlineMdMobile },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingBottom: 60 },

  hero: { marginBottom: Spacing.sm },
  identity: {
    alignItems: "center",
    gap: 6,
    marginTop: -48,
    paddingHorizontal: Spacing.containerMargin,
  },
  avatarWrap: { position: "relative", marginBottom: 4 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 36, fontWeight: "700" },
  verifiedDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...Typography.headlineSm },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  role: { ...Typography.bodyLg },
  memberSince: { ...Typography.labelMd, letterSpacing: 0.5, marginTop: 2 },

  body: {
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
  trailingValue: { ...Typography.labelMd, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },

  segment: {
    flexDirection: "row",
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  segmentText: { ...Typography.labelMd },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.containerMargin,
  },
  logoutText: { ...Typography.button },
});
