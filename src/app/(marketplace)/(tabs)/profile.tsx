import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography, type ThemeColors } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { logoutUser } from '@/lib/firebase/auth-service';
import type { ThemePreference } from '@/lib/theme-preference';
import { useAuth } from '@/providers/auth-provider';
import { ROLE_LABELS, isVerifiedRole, resolveProfileRole } from '@/constants/roles';

const themeOptions: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: 'system', label: 'System', icon: 'brightness-auto' },
  { id: 'light', label: 'Light', icon: 'light-mode' },
  { id: 'dark', label: 'Dark', icon: 'dark-mode' },
];

function Divider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.divider, { backgroundColor: colors.surfaceVariant }]} />;
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={[styles.rowIcon]}>
        <Icon name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: danger ? colors.error : colors.textMain }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <Icon name="chevron-right" size={20} color={colors.outline} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors, preference, setPreference } = useAppTheme();

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
    router.replace('/(marketplace)/(tabs)/home');
  }

  const effectiveRole = resolveProfileRole(profile);
  const isVerified = profile?.verificationStatus === 'verified';
  const isVerifiedTrader = isVerifiedRole(profile, 'trader');
  const initial = (profile?.displayName ?? '?').charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[effectiveRole] ?? 'Member';
  const memberYear = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getFullYear()
    : new Date().getFullYear();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</Text>
            </View>
            {isVerified ? (
              <View style={[styles.verifiedDot, { backgroundColor: colors.accent, borderColor: colors.background }]}>
                <Icon name="verified" size={16} color={colors.onSecondary} />
              </View>
            ) : null}
          </View>
          <Text style={[styles.name, { color: colors.primary }]}>{profile?.displayName}</Text>
          <View style={styles.roleRow}>
            <Text style={[styles.role, { color: colors.onSurfaceVariant }]}>{roleLabel}</Text>
            {isVerifiedTrader ? (
              <View style={[styles.proPill, { backgroundColor: colors.secondaryContainer }]}>
                <Text style={[styles.proText, { color: colors.onSecondaryContainer }]}>PRO</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.memberSince, { color: colors.textMuted }]}>MEMBER SINCE {memberYear}</Text>
        </View>

        {/* Business profile */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>BUSINESS PROFILE</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Row
            colors={colors}
            icon="verified-user"
            label="Verification Status"
            subtitle={isVerified ? 'Gold Authentication' : 'Not verified yet'}
            onPress={() => router.push('/profile/verify')}
            trailing={
              <Text style={[styles.trailingValue, { color: isVerified ? colors.successEmerald : colors.warningAmber }]}>
                {isVerified ? 'Verified' : 'Pending'}
              </Text>
            }
          />
          <Divider colors={colors} />
          <Row
            colors={colors}
            icon="storefront"
            label="Edit Business"
            subtitle="Update contact & info"
            onPress={() => router.push('/profile/business' as Href)}
          />
          {isVerifiedTrader ? (
            <>
              <Divider colors={colors} />
              <Row
                colors={colors}
                icon="visibility"
                label="View Public Shop"
                subtitle="See customer preview"
                onPress={() => router.push('/profile/business' as Href)}
              />
            </>
          ) : null}
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceContainerLowest, padding: Spacing.gutterMd, gap: Spacing.md }]}>
          <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
            {themeOptions.map((option) => {
              const active = preference === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setPreference(option.id)}
                  style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}>
                  <Icon name={option.icon} size={16} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                  <Text style={[styles.segmentText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account & app */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT &amp; APP</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Row
            colors={colors}
            icon="help-outline"
            label="Help Center"
            onPress={() => Linking.openURL('mailto:support@gemfort.app')}
          />
          <Divider colors={colors} />
          <Row
            colors={colors}
            icon="info-outline"
            label="About GemFort"
            trailing={<Text style={[styles.trailingValue, { color: colors.textMuted }]}>v1.0.0</Text>}
          />
        </View>

        {/* Log out */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log Out"
          onPress={() =>
            Alert.alert('Sign out?', 'You can sign back in anytime.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: handleLogout },
            ])
          }
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.6 }]}>
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { ...Typography.headlineMdMobile },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing.containerMargin, paddingBottom: 60, gap: Spacing.stackMd },

  identity: { alignItems: 'center', gap: 6, paddingVertical: Spacing.md },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  avatarInitial: { fontSize: 36, fontWeight: '700' },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.headlineSm },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  role: { ...Typography.bodyLg },
  proPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  proText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  memberSince: { ...Typography.labelMd, letterSpacing: 0.5, marginTop: 2 },

  sectionTitle: { ...Typography.labelMd, letterSpacing: 1, marginTop: Spacing.md, marginBottom: 2, marginLeft: 4 },
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.gutterMd, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { ...Typography.bodyLg, fontWeight: '600' },
  rowSub: { ...Typography.bodyMd, marginTop: 1 },
  trailingValue: { ...Typography.labelMd, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },

  segment: { flexDirection: 'row', borderRadius: Radius.full, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.full },
  segmentText: { ...Typography.labelMd },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: Spacing.lg, paddingVertical: 14 },
  logoutText: { ...Typography.button },
});
