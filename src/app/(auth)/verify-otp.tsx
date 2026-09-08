import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpInput } from 'react-native-otp-entry';

import { StoryChapter } from '@/components/brand/story-chapter';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { confirmPhoneVerificationCode } from '@/lib/firebase/phone-auth';
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
  const {
    phone: phoneParam,
    verificationId: verificationIdParam,
    afterRegistration,
  } = useLocalSearchParams<{
    phone?: string | string[];
    verificationId?: string | string[];
    afterRegistration?: string | string[];
  }>();
  const { refreshProfile } = useAuth();
  const phoneValue = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
  const verificationId = Array.isArray(verificationIdParam)
    ? verificationIdParam[0]
    : verificationIdParam;
  const phone = normalizePhoneNumber(phoneValue ?? '');
  const registrationFlow = Array.isArray(afterRegistration)
    ? afterRegistration[0]
    : afterRegistration;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const verifyingRef = useRef(false);

  async function handleConfirm(nextCode: string) {
    if (verifyingRef.current) return;

    const result = parseForm(verifyOtpSchema, { code: nextCode });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    if (!verificationId || !phone) {
      toast.error('This verification session has expired. Enter your phone number again.');
      return;
    }

    verifyingRef.current = true;
    setErrors({});
    try {
      await withLoading(async () => {
        await confirmPhoneVerificationCode(verificationId, result.data.code, phone);
        await markOnboardingComplete();
        await refreshProfile();
        router.replace(
          registrationFlow === '1'
            ? '/(auth)/business-onboarding'
            : '/(marketplace)/(tabs)/home',
        );
      }, 'Verifying…');
    } catch (e) {
      verifyingRef.current = false;
      const errorCode =
        typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code?: unknown }).code ?? '')
          : '';
      setErrors(
        errorCode === 'auth/invalid-verification-code' ||
          errorCode === 'auth/invalid-verification-id' ||
          errorCode === 'auth/code-expired'
          ? { code: 'Invalid or expired code. Try again.' }
          : {},
      );
      toast.error(friendlyError(e, 'Verification failed. Please try again.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ThemedScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <ScreenInset style={styles.lead}>
          <View
            style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}
            accessibilityRole="image"
            accessibilityLabel="Phone verification">
            <Icon name="phone" size={32} color={colors.primary} />
          </View>
          <StoryChapter
            title="Verify your phone"
            body={`Enter the 6-digit code sent to ${phone || 'your number'}.`}
            align="center"
          />
        </ScreenInset>

        <FormSection style={styles.otpSection}>
          <View style={styles.otpField}>
            <OtpInput
              numberOfDigits={6}
              autoFocus
              type="numeric"
              focusColor={colors.primary}
              onTextChange={() => {
                setErrors((current) => (current.code ? {} : current));
              }}
              onFilled={handleConfirm}
              textInputProps={{ accessibilityLabel: '6-digit verification code' }}
              theme={{
                containerStyle: styles.otpRow,
                pinCodeContainerStyle: {
                  ...styles.otpSlot,
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
                pinCodeTextStyle: {
                  ...styles.otpChar,
                  color: colors.text,
                },
                focusStickStyle: {
                  ...styles.fakeCaret,
                  backgroundColor: colors.primary,
                },
              }}
            />
            {errors.code ? (
              <Text
                style={[styles.error, { color: colors.error }]}
                accessibilityLiveRegion="polite">
                {errors.code}
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  lead: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpSection: {
    alignItems: 'center',
  },
  otpField: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  otpRow: {
    width: '100%',
    maxWidth: 304,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  otpSlot: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
  },
  otpChar: {
    ...Typography.headlineMd,
  },
  fakeCaret: {
    width: 2,
    height: 28,
    borderRadius: 1,
  },
  error: { ...Typography.bodySmall, textAlign: 'center' },
});
