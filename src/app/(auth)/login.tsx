import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/brand-mark';
import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { Brand } from '@/constants/brand-story';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { getUserProfile, loginUser, needsPhoneVerification } from '@/lib/firebase/auth-service';
import { friendlyError } from '@/lib/errors';
import { markOnboardingComplete } from '@/lib/onboarding';
import { loginSchema, parseForm } from '@/lib/validation/form-schemas';
import { useToast } from '@/providers/toast-provider';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function handleLogin() {
    Keyboard.dismiss();
    const result = parseForm(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const loggedInUser = await loginUser(result.data.email, result.data.password);
      await markOnboardingComplete();
      const profile = await getUserProfile(loggedInUser.uid);
      if (needsPhoneVerification(profile)) {
        router.replace({
          pathname: '/(auth)/verify-otp',
          params: { phone: profile!.phone },
        });
      } else {
        router.replace('/(marketplace)/(tabs)/home');
      }
    } catch (e) {
      const msg = friendlyError(e, 'Could not sign in. Please try again.');
      setErrors({ password: msg });
      toast.error(msg);
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
          <View style={styles.brandBlock}>
            <BrandMark size="md" showWordmark />
            <Text style={[styles.tagline, { color: colors.textMuted }]}>{Brand.tagline}</Text>
          </View>

          <StoryChapter
            title="Welcome back"
            body="Sign in to continue your gem business journey."
            accent="primary"
          />

          <FormSection>
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
              placeholder="you@example.com"
              returnKeyType="next"
              blurOnSubmit={false}
              error={errors.email}
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
              autoComplete="password"
              textContentType="password"
              placeholder="Enter password"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleLogin}
              error={errors.password}
            />
          </FormSection>

          <Button title="Sign in" icon="login" loading={loading} onPress={handleLogin} />

          <View style={styles.links}>
            <Link href="/(auth)/forgot-password">
              <Text style={[styles.linkText, { color: colors.primary }]}>Forgot password?</Text>
            </Link>
            <Link href="/(auth)/register">
              <Text style={[styles.linkText, { color: colors.primary }]}>Create an account</Text>
            </Link>
          </View>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  brandBlock: { gap: Spacing.sm },
  tagline: { ...Typography.bodySmall },
  links: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  linkText: { ...Typography.bodyMd, fontWeight: '600' },
});
