import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { resetPassword } from '@/lib/firebase/auth-service';
import { friendlyError } from '@/lib/errors';
import { forgotPasswordSchema, parseForm } from '@/lib/validation/form-schemas';
import { useToast } from '@/providers/toast-provider';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleReset() {
    Keyboard.dismiss();
    const result = parseForm(forgotPasswordSchema, { email });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await resetPassword(result.data.email);
      setSent(true);
      toast.success('Check your inbox for reset instructions.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send reset email.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Reset password" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ThemedScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <StoryChapter
            title="Forgot password?"
            body="Enter your email and we will send a link to choose a new password."
            accent="primary"
          />

          <FormSection>
            <Input
              label="Email"
              leftIcon="email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setErrors({});
                setSent(false);
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleReset}
              error={errors.email}
            />
          </FormSection>

          {sent ? (
            <Text style={[styles.success, { color: colors.successEmerald }]} selectable>
              Reset link sent. Check your inbox (and spam folder).
            </Text>
          ) : null}

          <Button
            title={sent ? 'Resend link' : 'Send reset link'}
            icon="send"
            loading={loading}
            onPress={handleReset}
          />
          <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
        </ThemedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  success: { ...Typography.bodyMd, textAlign: 'center', lineHeight: 22 },
});
