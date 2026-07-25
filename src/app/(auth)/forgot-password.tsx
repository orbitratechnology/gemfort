import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthIllustration } from '@/components/auth/auth-illustration';
import { AuthHeading, AuthScreen, authGreeting } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { resetPassword } from '@/lib/firebase/auth-service';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
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
      haptics.success();
      toast.success('Check your inbox for reset instructions.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send reset email.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen safeTop>
      <AuthIllustration />
      <AuthHeading
        greeting={authGreeting()}
        title={sent ? 'Check email' : 'Reset password'}
        subtitle={
          sent
            ? 'Use the link we sent, then sign in with your new password.'
            : 'Enter your email and we will send a reset link.'
        }
      />

      <View style={styles.form}>
        {sent ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <Text style={[styles.successBody, { color: colors.textSecondary }]}>
              Reset link sent to
            </Text>
            <Text selectable style={[styles.successEmail, { color: colors.text }]}>
              {email.trim()}
            </Text>
          </View>
        ) : (
          <AuthField
            label="Email"
            leftIcon="email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrors({});
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={handleReset}
            error={errors.email}
          />
        )}

        <Button
          title={sent ? 'Resend link' : 'Send reset link'}
          loading={loading}
          onPress={handleReset}
          style={styles.cta}
        />
        <Button title="Back to Sign In" variant="ghost" onPress={() => router.back()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
    maxWidth: 400,
    gap: Spacing.md,
  },
  success: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  successBody: {
    ...Typography.bodyLarge,
    textAlign: 'center',
  },
  successEmail: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    textAlign: 'center',
  },
  cta: {
    minHeight: 52,
  },
});
