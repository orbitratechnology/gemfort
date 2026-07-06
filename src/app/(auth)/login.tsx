import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/brand-mark';
import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand } from '@/constants/brand-story';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { loginUser, getUserProfile, needsPhoneVerification } from '@/lib/firebase/auth-service';
import { markOnboardingComplete } from '@/lib/onboarding';
import { useToast } from '@/providers/toast-provider';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await loginUser(email, password);
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
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled">
          <BrandMark size="md" showWordmark />
          <Text style={[styles.tagline, { color: colors.textMuted }]}>{Brand.tagline}</Text>
          <StoryChapter
            title="Welcome back"
            body="Sign in to continue your gem business journey."
            accent="primary"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter password"
            error={error}
          />
          <Button title="Sign In" loading={loading} onPress={handleLogin} />
          <Link href="/(auth)/forgot-password" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Forgot password?</Text>
          </Link>
          <Link href="/(auth)/register" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Create an account</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.xxl, gap: Spacing.lg },
  tagline: { ...Typography.bodySmall, marginTop: -Spacing.sm },
  link: { alignSelf: 'center' },
  linkText: { ...Typography.body },
});
