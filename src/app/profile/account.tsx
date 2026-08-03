import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, FormSectionLabel } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import {
  changePassword,
  deleteAccount,
  deleteAccountWithProvider,
  sendPasswordResetForCurrentUser,
} from '@/lib/firebase/auth-service';
import {
  changePasswordSchema,
  deleteAccountSchema,
  parseForm,
} from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { confirm } from '@/providers/confirm-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';

export default function AccountSettingsScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const [deletePassword, setDeletePassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const providerIds = user.providerData.map((provider) => provider.providerId);
  const hasPasswordProvider = providerIds.includes('password');
  const socialProvider = providerIds.includes('google.com')
    ? 'google.com'
    : providerIds.includes('apple.com')
      ? 'apple.com'
      : null;

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
        await changePassword(result.data.currentPassword, result.data.newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Password updated.');
      }, 'Updating password…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update password.'));
    }
  }

  async function handleSendResetLink() {
    Keyboard.dismiss();
    try {
      await withLoading(async () => {
        await sendPasswordResetForCurrentUser();
        toast.success('Reset link sent. Check your inbox.');
      }, 'Sending reset link…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send reset email.'));
    }
  }

  function confirmDeleteAccount() {
    Keyboard.dismiss();
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteErrors({ confirmText: 'Type DELETE to confirm' });
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
      title: 'Delete account permanently?',
      message:
        'This removes your profile, listings, workspace data, uploads, and sign-in. This cannot be undone.',
      tone: 'destructive',
      confirmLabel: 'Delete forever',
      cancelLabel: 'Cancel',
      icon: 'delete-forever',
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
        throw new Error('Sign in again with your original provider to delete this account.');
      }
      toast.success('Your account has been deleted.');
      router.replace('/(marketplace)/(tabs)/home');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete account.'));
      throw e;
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Account settings" />
      <ThemedScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <FormSectionLabel title="SIGNED IN AS" />
        <FormSection>
          <Text style={[styles.email, { color: colors.textMain }]}>
            {user.email}
          </Text>
        </FormSection>

        {hasPasswordProvider ? <>
        <FormSectionLabel title="CHANGE PASSWORD" />
        <FormSection>
          <View style={styles.fields}>
            <Input
              label="Current password"
              leftIcon="lock"
              value={currentPassword}
              onChangeText={(v) => {
                setCurrentPassword(v);
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
              onChangeText={(v) => {
                setNewPassword(v);
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
              onChangeText={(v) => {
                setConfirmPassword(v);
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
          </View>
        </FormSection>

        <FormSectionLabel title="RESET VIA EMAIL" />
        <FormSection>
          <View style={styles.fields}>
            <Button
              title="Send reset link"
              icon="send"
              variant="secondary"
              onPress={handleSendResetLink}
            />
          </View>
        </FormSection>
        </> : null}

        <FormSectionLabel title="DELETE ACCOUNT" />
        <FormSection>
          <View style={styles.fields}>
            <Text style={[styles.dangerBody, { color: colors.textMuted }]}>
              Deletes your Auth account and all GemFort data tied to you — profile, business,
              listings, verification docs, notifications, workspace records, and uploaded files.
            </Text>
            {hasPasswordProvider ? <Input
              label="Password"
              leftIcon="lock"
              value={deletePassword}
              onChangeText={(v) => {
                setDeletePassword(v);
                setDeleteErrors({});
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              error={deleteErrors.password}
            /> : (
              <Text style={[styles.dangerBody, { color: colors.textMuted }]}>
                You will be asked to sign in with {socialProvider === 'apple.com' ? 'Apple' : 'Google'} again before deletion.
              </Text>
            )}
            <Input
              label="Type DELETE to confirm"
              leftIcon="warning"
              value={confirmText}
              onChangeText={(v) => {
                setConfirmText(v);
                setDeleteErrors({});
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={deleteErrors.confirmText}
            />
            <Button
              title="Delete my account"
              icon="delete-forever"
              onPress={confirmDeleteAccount}
              style={{ backgroundColor: colors.error }}
              textStyle={{ color: colors.onError }}
            />
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
  email: { ...Typography.bodyLg, fontWeight: '600' },
  fields: { gap: Spacing.lg },
  dangerBody: { ...Typography.bodyMd, lineHeight: 20 },
});
