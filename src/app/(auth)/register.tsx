import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/brand-mark';
import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { PhoneNumberField } from '@/components/ui/phone-number-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { Brand } from '@/constants/brand-story';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { registerUser } from '@/lib/firebase/auth-service';
import { friendlyError } from '@/lib/errors';
import { parseForm, registerSchema } from '@/lib/validation/form-schemas';
import { useToast } from '@/providers/toast-provider';
import type { UserRole } from '@/types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'trader', label: 'Trader' },
  { value: 'lapidary', label: 'Lapidary' },
  { value: 'gem_lab', label: 'Gem Lab' },
];

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('trader');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleRegister() {
    Keyboard.dismiss();
    const result = parseForm(registerSchema, {
      displayName,
      email,
      phone,
      password,
      role,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const data = result.data;
      const { phone: verifiedPhone } = await registerUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        phone: data.phone,
        role: data.role,
      });
      router.replace({ pathname: '/(auth)/verify-otp', params: { phone: verifiedPhone } });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create account. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ThemedScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <ScreenInset style={styles.lead}>
            <BrandMark size="md" />
            <StoryChapter
              title="Create your account"
              body={`${Brand.subtagline} Track stones and connect with traders.`}
            />
          </ScreenInset>

          <FormSection title="Your details">
            <Input
              label="Full name"
              leftIcon="person"
              value={displayName}
              onChangeText={(v) => {
                setDisplayName(v);
                clearField('displayName');
              }}
              autoComplete="name"
              textContentType="name"
              error={errors.displayName}
            />
            <Input
              label="Email"
              leftIcon="email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearField('email');
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              error={errors.email}
            />
            <PhoneNumberField
              label="Phone"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                clearField('phone');
              }}
              error={errors.phone}
            />
            <Input
              label="Password"
              leftIcon="lock"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clearField('password');
              }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 8 characters"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleRegister}
              error={errors.password}
            />
          </FormSection>

          <FormSection title="I am a…">
            <ChipSelect
              layout="stack"
              options={ROLES}
              value={role}
              onChange={(v) => {
                setRole(v);
                clearField('role');
              }}
              error={errors.role}
            />
          </FormSection>

          <ScreenInset style={styles.cta}>
            <Button
              title="Create account"
              icon="person-add"
              loading={loading}
              onPress={handleRegister}
            />

            <Link href="/(auth)/login">
              <Text style={[styles.linkText, { color: colors.primary }]}>
                Already have an account? Sign in
              </Text>
            </Link>
          </ScreenInset>
        </ThemedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  lead: { gap: Spacing.lg },
  cta: { gap: Spacing.lg },
  linkText: {
    ...Typography.bodyMd,
    fontWeight: '600',
    textAlign: 'center',
  },
});
