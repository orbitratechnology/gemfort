import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
    FormSection,
    FormSectionLabel,
    ScreenInset,
} from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import {
    changePassword,
    deleteAccount,
    deleteAccountWithProvider,
    sendPasswordResetForCurrentUser,
} from "@/lib/firebase/auth-service";
import {
    changePasswordSchema,
    deleteAccountSchema,
    parseForm,
} from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";

export default function AccountSettingsScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  if (!user) return <Redirect href="/(auth)/login" />;

  const providerIds = user.providerData.map((provider) => provider.providerId);
  const hasPasswordProvider = providerIds.includes("password");
  const socialProvider = providerIds.includes("google.com")
    ? "google.com"
    : providerIds.includes("apple.com")
      ? "apple.com"
      : null;
  const signInMethod = hasPasswordProvider
    ? "Email and password"
    : socialProvider === "apple.com"
      ? "Sign in with Apple"
      : socialProvider === "google.com"
        ? "Google"
        : "Your original sign-in method";
  const canDelete = hasPasswordProvider || Boolean(socialProvider);

  async function handleChangePassword() {
    Keyboard.dismiss();
    const result = parseForm(changePasswordSchema, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!result.success) {
      setPasswordErrors(result.errors);
      return;
    }

    setPasswordErrors({});
    try {
      await withLoading(async () => {
        await changePassword(
          result.data.currentPassword,
          result.data.newPassword,
        );
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Password updated.");
      }, "Updating password…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update password."));
    }
  }

  async function handleSendResetLink() {
    Keyboard.dismiss();
    try {
      await withLoading(async () => {
        await sendPasswordResetForCurrentUser();
        toast.success("Reset link sent. Check your inbox.");
      }, "Sending reset link…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not send reset email."));
    }
  }

  function confirmDeleteAccount() {
    Keyboard.dismiss();
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteErrors({ confirmText: "Type DELETE to confirm." });
      return;
    }
    if (hasPasswordProvider) {
      const result = parseForm(deleteAccountSchema, {
        password: deletePassword,
        confirmText,
      });
      if (!result.success) {
        setDeleteErrors(result.errors);
        return;
      }
    }

    void confirm({
      title: "Delete account permanently?",
      message:
        "Your GemFort profile and sign-in will be removed. Your business, listings, requests, workspace records, notifications, verification files, and uploaded photos or documents will be deleted too. Any shared records that need to remain for another member will no longer show your identity. This cannot be undone.",
      tone: "destructive",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      icon: "delete-forever",
      onConfirm: runDelete,
    });
  }

  async function runDelete() {
    setDeleteErrors({});
    try {
      if (hasPasswordProvider) {
        await deleteAccount(deletePassword);
      } else if (socialProvider) {
        await deleteAccountWithProvider(socialProvider);
      } else {
        throw new Error(
          "Sign in again with your original provider to delete this account.",
        );
      }
      toast.success("Your account has been deleted.");
      router.replace("/(marketplace)/(tabs)/home");
    } catch (error) {
      toast.error(friendlyError(error, "Could not delete account."));
      throw error;
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Account settings" />
      <ThemedScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenInset>
          <View
            style={[
              styles.identityCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View
              style={[
                styles.identityIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon name="person" size={22} color={colors.onPrimaryContainer} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={[styles.identityLabel, { color: colors.textMuted }]}>
                SIGNED IN AS
              </Text>
              <Text
                selectable
                style={[styles.email, { color: colors.textMain }]}
              >
                {user.email ?? "No email address"}
              </Text>
              <Text style={[styles.signInMethod, { color: colors.textMuted }]}>
                {signInMethod}
              </Text>
            </View>
          </View>
        </ScreenInset>

        {hasPasswordProvider ? (
          <>
            <FormSectionLabel title="PASSWORD" />
            <FormSection>
              <View style={styles.fields}>
                <Input
                  label="Current password"
                  leftIcon="lock"
                  value={currentPassword}
                  onChangeText={(value) => {
                    setCurrentPassword(value);
                    setPasswordErrors({});
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  error={passwordErrors.currentPassword}
                />
                <Input
                  label="New password"
                  leftIcon="vpn-key"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    setPasswordErrors({});
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={passwordErrors.newPassword}
                />
                <Input
                  label="Confirm new password"
                  leftIcon="vpn-key"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setPasswordErrors({});
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={passwordErrors.confirmPassword}
                />
                <Button
                  title="Update password"
                  icon="check"
                  onPress={handleChangePassword}
                />
                <Button
                  title="Email me a reset link"
                  icon="send"
                  variant="ghost"
                  onPress={handleSendResetLink}
                />
              </View>
            </FormSection>
          </>
        ) : (
          <>
            <FormSectionLabel title="SIGN-IN METHOD" />
            <FormSection>
              <Text style={[styles.body, { color: colors.textMuted }]}>
                You use {signInMethod}. Sensitive actions will ask you to sign
                in again.
              </Text>
            </FormSection>
          </>
        )}

        <FormSectionLabel title="DELETE ACCOUNT" />
        <FormSection>
          <View style={styles.fields}>
            <View
              style={[
                styles.dangerCallout,
                { backgroundColor: colors.errorContainer },
              ]}
            >
              <Icon name="warning" size={20} color={colors.onErrorContainer} />
              <Text
                style={[styles.dangerText, { color: colors.onErrorContainer }]}
              >
                This permanently removes your account and GemFort data. It
                cannot be undone.
              </Text>
            </View>
            {hasPasswordProvider ? (
              <Input
                label="Password"
                leftIcon="lock"
                value={deletePassword}
                onChangeText={(value) => {
                  setDeletePassword(value);
                  setDeleteErrors({});
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                error={deleteErrors.password}
              />
            ) : (
              <Text style={[styles.body, { color: colors.textMuted }]}>
                Continue to confirm, then sign in with{" "}
                {socialProvider === "apple.com" ? "Apple" : "Google"} one more
                time to protect your account.
              </Text>
            )}
            <Input
              label="Type DELETE to confirm"
              leftIcon="warning"
              value={confirmText}
              onChangeText={(value) => {
                setConfirmText(value);
                setDeleteErrors({});
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={deleteErrors.confirmText}
            />
            <Button
              title={
                socialProvider && !hasPasswordProvider
                  ? `Continue with ${socialProvider === "apple.com" ? "Apple" : "Google"} to delete`
                  : "Delete my account"
              }
              icon="delete-forever"
              variant="destructive"
              disabled={!canDelete}
              onPress={confirmDeleteAccount}
            />
            {!canDelete ? (
              <Text style={[styles.body, { color: colors.error }]}>
                Sign in with your original provider before deleting this
                account.
              </Text>
            ) : null}
          </View>
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
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderCurve: "continuous",
  },
  identityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: { flex: 1, gap: 2 },
  identityLabel: { ...Typography.labelMd, letterSpacing: 0.8 },
  email: { ...Typography.bodyLg, fontFamily: "Poppins_600SemiBold" },
  signInMethod: { ...Typography.bodyMd },
  fields: { gap: Spacing.lg },
  body: { ...Typography.bodyMd, lineHeight: 20 },
  dangerCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  dangerText: { ...Typography.bodyMd, flex: 1, lineHeight: 20 },
});
