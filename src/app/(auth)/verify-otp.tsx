import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import {
  confirmPhoneVerificationCode,
  sendPhoneVerificationCode,
  skipPhoneVerificationForDev,
} from '@/lib/firebase/phone-auth';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';
import { markOnboardingComplete } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function VerifyOtpScreen() {
  const { colors } = useAppTheme();
  const ts = useThemeStyles();
  const toast = useToast();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const { user } = useAuth();
  const phone = normalizePhoneNumber(phoneParam ?? '');

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
      toast.success(`We sent a verification code to ${phone}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send code. Try again.');
    } finally {
      setSending(false);
    }
  }, [phone]);

  async function handleConfirm() {
    if (!verificationId || code.length < 6) {
      toast.error('Enter the 6-digit code from your SMS.');
      return;
    }
    setConfirming(true);
    try {
      await confirmPhoneVerificationCode(verificationId, code.trim());
      await markOnboardingComplete();
      router.replace('/(marketplace)/(tabs)/home');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed. Invalid code.');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ThemedScrollView contentContainerStyle={styles.container}>
          <StoryChapter
            title="Verify your phone"
            body={`We will send a one-time SMS code to ${phone || 'your number'}.`}
          />

          <Button
            title={verificationId ? 'Resend Code' : 'Send Code'}
            loading={sending}
            disabled={cooldown > 0}
            onPress={handleSendCode}
          />
          {cooldown > 0 ? (
            <Text style={[styles.cooldown, ts.textMuted]}>Resend available in {cooldown}s</Text>
          ) : null}

          <Input
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button title="Verify & Continue" loading={confirming} onPress={handleConfirm} />

          {__DEV__ ? (
            <Button title="Skip (dev only)" variant="ghost" onPress={handleSkipDev} />
          ) : null}
        </ThemedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.xxl, gap: Spacing.lg },
  cooldown: { ...Typography.caption, textAlign: 'center' },
});
