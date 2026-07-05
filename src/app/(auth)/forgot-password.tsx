import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { resetPassword } from '@/lib/firebase/auth-service';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert('Email sent', 'Check your inbox for reset instructions.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StoryChapter
        title="Reset password"
        body="Enter your email and we will send a link to choose a new password."
        accent="primary"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Button title="Send Reset Link" loading={loading} onPress={handleReset} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: Spacing.xxl, gap: Spacing.lg },
});
