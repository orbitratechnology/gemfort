import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { resetPassword } from '@/lib/firebase/auth-service';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success('Check your inbox for reset instructions.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send reset email.'));
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
