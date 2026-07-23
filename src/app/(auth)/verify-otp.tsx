import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  confirmPhoneVerificationCode,
  sendPhoneVerificationCode,
  skipPhoneVerificationForDev,
} from '@/lib/firebase/phone-auth';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';
import { friendlyError } from '@/lib/errors';
import { markOnboardingComplete } from '@/lib/onboarding';
import { parseForm, verifyOtpSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function VerifyOtpScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const { user } = useAuth();
  const phone = normalizePhoneNumber(phoneParam ?? '');

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = useCallback(async () => {
    if (!phone) {
      toast.error('No phone number to verify.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Firebase not configured. Set EXPO_PUBLIC_FIREBASE_* env vars.');
      return;
    }
    setSending(true);
    try {
      const id = await sendPhoneVerificationCode(phone);
      setVerificationId(id);
      setCooldown(60);
      toast.success(`Code sent to ${phone}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send code. Try again.'));
    } finally {
      setSending(false);
    }
  }, [phone, toast]);

  async function handleConfirm() {
    Keyboard.dismiss();
    if (!verificationId) {
      toast.error('Send a verification code first.');
      return;
    }
    const result = parseForm(verifyOtpSchema, { code });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setConfirming(true);
    setErrors({});
    try {
      await confirmPhoneVerificationCode(verificationId, result.data.code);
      await markOnboardingComplete();
      router.replace('/(marketplace)/(tabs)/home');
    } catch (e) {
      setErrors({ code: 'Invalid or expired code. Try again.' });
      toast.error(friendlyError(e, 'Verification failed. Invalid code.'));
    } finally {
      setConfirming(false);
    }
  }

  async function handleSkipDev() {
    if (!user || !__DEV__) return;
    await skipPhoneVerificationForDev(user.uid);
    await markOnboardingComplete();
    router.replace('/(marketplace)/(tabs)/home');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ThemedScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <ScreenInset style={styles.lead}>
          <StoryChapter
            title="Verify your phone"
            body={`We will send a one-time SMS code to ${phone || 'your number'}.`}
          />

          <Button
            title={verificationId ? 'Resend code' : 'Send code'}
            icon="sms"
            loading={sending}
            disabled={cooldown > 0}
            onPress={handleSendCode}
          />
          {cooldown > 0 ? (
            <Text style={[styles.cooldown, { color: colors.textMuted }]}>
              Resend available in {cooldown}s
            </Text>
          ) : null}
        </ScreenInset>

        <FormSection title="Enter code">
          <Input
            label="6-digit code"
            leftIcon="pin"
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setErrors({});
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            placeholder="000000"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={handleConfirm}
            error={errors.code}
          />
        </FormSection>

        <ScreenInset style={styles.cta}>
          <Button
            title="Verify & continue"
            icon="verified"
            loading={confirming}
            onPress={handleConfirm}
          />

          {__DEV__ ? (
            <Button title="Skip (dev only)" variant="ghost" onPress={handleSkipDev} />
          ) : null}
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  lead: { gap: Spacing.lg },
  cta: { gap: Spacing.lg },
  cooldown: { ...Typography.caption, textAlign: 'center' },
});
