import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, TouchTarget, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

type SocialAuthButtonsProps = {
  disabled?: boolean;
  /** Provider whose sign-in is in flight: it shows a spinner and both buttons are disabled. */
  pendingProvider?: 'google' | 'apple' | null;
  onGooglePress: () => Promise<void>;
  onApplePress: () => Promise<void>;
  appleButtonType: 'signIn' | 'signUp';
  showGoogle?: boolean;
};

/** Native provider buttons so Google and Apple branding stays compliant. */
export function SocialAuthButtons({
  disabled = false,
  pendingProvider = null,
  onGooglePress,
  onApplePress,
  appleButtonType,
  showGoogle = true,
}: SocialAuthButtonsProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || pendingProvider != null;
  const showApple =
    Platform.OS === 'ios' &&
    Constants.expoConfig?.extra?.iosPersonalTeamBuild !== true;

  return (
    <View style={styles.container}>
      {showGoogle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={isDisabled}
          accessibilityState={{ disabled: isDisabled, busy: pendingProvider === 'google' }}
          onPress={haptics.wrap('light', onGooglePress)}
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
            },
            isDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {pendingProvider === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
              <Path
                fill="#4285F4"
                d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
              />
              <Path
                fill="#34A853"
                d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.97.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.6Z"
              />
              <Path
                fill="#FBBC05"
                d="M6.54 13.68A5.85 5.85 0 0 1 6.23 12c0-.58.1-1.14.31-1.68V7.79H3.3A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.21l3.24-2.53Z"
              />
              <Path
                fill="#EA4335"
                d="M12 6.29c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 3.35 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.01 9.46 6.29 12 6.29Z"
              />
            </Svg>
          )}
          <Text style={[styles.googleText, { color: colors.text }]}>Continue with Google</Text>
        </Pressable>
      ) : null}
      {showApple ? (
        <View style={styles.appleWrapper} pointerEvents={isDisabled ? 'none' : 'auto'}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              appleButtonType === 'signUp'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
                colors.text === '#f5f5f5'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={10}
            style={[styles.appleButton, isDisabled && styles.disabled]}
            onPress={() => {
              if (!isDisabled) void onApplePress();
            }}
          />
          {pendingProvider === 'apple' ? (
            <View style={styles.appleSpinner} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.text} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Spacing.sm,
  },
  googleButton: {
    width: '100%',
    minHeight: TouchTarget.minHeight,
    borderRadius: Radius.full,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleText: {
    ...Typography.bodyLg,
    fontWeight: '600',
  },
  appleWrapper: {
    width: '100%',
  },
  appleSpinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButton: {
    width: '100%',
    height: TouchTarget.minHeight,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
