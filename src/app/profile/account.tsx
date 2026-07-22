import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { alert } from '@/lib/alert';
import { friendlyError } from '@/lib/errors';
import {
  changePassword,
  deleteAccount,
  sendPasswordResetForCurrentUser,
} from '@/lib/firebase/auth-service';
import {
  changePasswordSchema,
  deleteAccountSchema,
  parseForm,
} from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AccountSettingsScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

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

    setChangingPassword(true);
    setPasswordErrors({});
    try {
      await changePassword(result.data.currentPassword, result.data.newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update password.'));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSendResetLink() {
    Keyboard.dismiss();
    setSendingReset(true);
    try {
      await sendPasswordResetForCurrentUser();
      toast.success('Reset link sent. Check your inbox.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send reset email.'));
    } finally {
      setSendingReset(false);
    }
  }

  function confirmDelete() {
    Keyboard.dismiss();
    const result = parseForm(deleteAccountSchema, {
      password: deletePassword,
      confirmText,
    });
    if (!result.success) {
      setDeleteErrors(result.errors);
      return;
    }

    alert(
      'Delete account permanently?',
      'This removes your profile, listings, workspace data, uploads, and sign-in. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            void runDelete(result.data.password);
          },
        },
      ],
      { haptic: 'error' },
    );
  }

  async function runDelete(password: string) {
    setDeleting(true);
    setDeleteErrors({});
    try {
      await deleteAccount(password);
      toast.success('Your account has been deleted.');
      router.replace('/(marketplace)/(tabs)/home');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete account.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Account settings" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ThemedScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <FormSectionLabel title="SIGNED IN AS" />
          <FormSection>
            <Text style={[styles.email, { color: colors.textMain }]} selectable>
              {user.email}
            </Text>
          </FormSection>

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
                loading={changingPassword}
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
                loading={sendingReset}
                onPress={handleSendResetLink}
              />
            </View>
          </FormSection>

          <FormSectionLabel title="DELETE ACCOUNT" />
          <FormSection>
            <View style={styles.fields}>
              <Text style={[styles.dangerBody, { color: colors.textMuted }]}>
                Deletes your Auth account and all GemFort data tied to you — profile, business,
                listings, verification docs, notifications, workspace records, and uploaded files.
              </Text>
              <Input
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
              />
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
                loading={deleting}
                onPress={confirmDelete}
                style={{ backgroundColor: colors.error }}
                textStyle={{ color: colors.onError }}
              />
            </View>
          </FormSection>
        </ThemedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.section,
    gap: Spacing.stackMd,
  },
  email: { ...Typography.bodyLg, fontWeight: '600' },
  fields: { gap: Spacing.lg },
  dangerBody: { ...Typography.bodyMd, lineHeight: 20 },
});
