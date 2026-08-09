import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { MaskedInput } from '@/components/ui/masked-input';
import { ThemedScrollView } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  confirmPhoneVerificationCode,
  sendPhoneVerificationCode,
  skipPhoneVerificationForDev,
} from '@/lib/firebase/phone-auth';
import { attemptPhoneNumberVerification } from '@/lib/firebase/phone-pnv';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';
import { friendlyError } from '@/lib/errors';
import { markOnboardingComplete } from '@/lib/onboarding';
import { parseForm, verifyOtpSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';

export default function VerifyOtpScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const { user, refreshProfile } = useAuth();
  const phone = normalizePhoneNumber(phoneParam ?? '');

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pnvChecking, setPnvChecking] = useState(false);
  const pnvAttemptedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Android-first: try carrier-level Phone Number Verification on entry. Any
  // failure (unsupported carrier, declined consent, mismatch) falls back to
  // the SMS flow below.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isFirebaseConfigured) return;
    if (pnvAttemptedRef.current) return;
    pnvAttemptedRef.current = true;
    let cancelled = false;

    (async () => {
      setPnvChecking(true);
      try {
        const attempt = await attemptPhoneNumberVerification(phone);
        if (cancelled) return;
        if (attempt.status === 'verified') {
          await markOnboardingComplete();
          await refreshProfile();
          router.replace('/(marketplace)/(tabs)/home');
        }
      } catch (error) {
        if (cancelled) return;
        toast.error(
          friendlyError(error, 'That mobile number is already linked to another GemFort account.'),
        );
      } finally {
        if (!cancelled) setPnvChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phone, refreshProfile, toast]);

  const handleSendCode = useCallback(async () => {
    if (!phone) {
      toast.error('No phone number to verify.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Firebase not configured. Set EXPO_PUBLIC_FIREBASE_* env vars.');
      return;
    }
    try {
      await withLoading(async () => {
        const id = await sendPhoneVerificationCode(phone);
        setVerificationId(id);
        setCooldown(60);
        toast.success(`Code sent to ${phone}`);
      }, 'Sending code…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send code. Try again.'));
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

    setErrors({});
    try {
      await withLoading(async () => {
        await confirmPhoneVerificationCode(verificationId, result.data.code);
        await markOnboardingComplete();
        await refreshProfile();
        router.replace('/(marketplace)/(tabs)/home');
      }, 'Verifying…');
    } catch (e) {
      setErrors({ code: 'Invalid or expired code. Try again.' });
      toast.error(friendlyError(e, 'Verification failed. Invalid code.'));
    }
  }

  async function handleSkipDev() {
    if (!user || !__DEV__) return;
    await skipPhoneVerificationForDev(user.uid, phone);
    await markOnboardingComplete();
    await refreshProfile();
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
            body={
              Platform.OS === 'android'
                ? `We will verify ${phone || 'your number'} with your mobile carrier first. If that is not possible, we will send a one-time SMS code.`
                : `We will send a one-time SMS code to ${phone || 'your number'}.`
            }
          />

          {pnvChecking ? (
            <Text style={[styles.cooldown, { color: colors.textMuted }]}>
              Checking your carrier for instant verification…
            </Text>
          ) : null}

          <Button
            title={verificationId ? 'Resend code' : 'Send code'}
            icon="sms"
            disabled={cooldown > 0 || pnvChecking}
            onPress={handleSendCode}
          />
          {cooldown > 0 ? (
            <Text style={[styles.cooldown, { color: colors.textMuted }]}>
              Resend available in {cooldown}s
            </Text>
          ) : null}
        </ScreenInset>

        <FormSection title="Enter code">
          <MaskedInput
            label="6-digit code"
            mode="custom"
            mask="999999"
            leftIcon="pin"
            value={code}
            onChangeText={(v, raw) => {
              setCode(raw.slice(0, 6));
              setErrors({});
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
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
