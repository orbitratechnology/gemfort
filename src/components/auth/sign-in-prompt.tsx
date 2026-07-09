import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type SignInPromptProps = {
  title: string;
  message: string;
};

/** Inline auth gate — avoids Redirect inside nested tab navigators (Fabric crash on Android). */
export function SignInPrompt({ title, message }: SignInPromptProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
        <Icon name="lock" size={32} color={colors.primary} />
      </View>
      <StoryChapter title={title} body={message} accent="primary" />
      <Button
        title="Sign In"
        icon="login"
        testID="sign-in-prompt-login"
        onPress={() => router.push('/(auth)/login')}
      />
      <Button
        title="Create Account"
        icon="person-add"
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
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
