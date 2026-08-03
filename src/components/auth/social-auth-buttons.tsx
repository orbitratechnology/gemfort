import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignInButton } from 'react-native-nitro-google-signin';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { Spacing } from '@/constants/design-tokens';

type SocialAuthButtonsProps = {
  disabled?: boolean;
  onGooglePress: () => Promise<void>;
  onApplePress: () => Promise<void>;
  appleButtonType: 'signIn' | 'signUp';
};

/** Native provider buttons so Google and Apple branding stays compliant. */
export function SocialAuthButtons({
  disabled = false,
  onGooglePress,
  onApplePress,
  appleButtonType,
}: SocialAuthButtonsProps) {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <GoogleSignInButton
        signInBehavior="none"
        size="wide"
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        disabled={disabled}
        onPress={onGooglePress}
        accessibilityLabel="Continue with Google"
      />
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            appleButtonType === 'signUp'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={
            colorScheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={10}
          style={styles.appleButton}
          onPress={() => void onApplePress()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  appleButton: {
    width: 312,
    height: 48,
  },
});
