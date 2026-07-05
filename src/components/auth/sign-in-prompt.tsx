import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Spacing, Typography } from '@/constants/design-tokens';

type SignInPromptProps = {
  title: string;
  message: string;
};

/** Inline auth gate — avoids Redirect inside nested tab navigators (Fabric crash on Android). */
export function SignInPrompt({ title, message }: SignInPromptProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StoryChapter title={title} body={message} accent="primary" />
      <Button
        title="Sign In"
        testID="sign-in-prompt-login"
        onPress={() => router.push('/(auth)/login')}
      />
      <Button
        title="Create Account"
        testID="sign-in-prompt-register"
        variant="secondary"
        onPress={() => router.push('/(auth)/register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
});
