import { Link, router } from "expo-router";
import { useState } from "react";
import {
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { AuthField } from "@/components/auth/auth-field";
import { AuthIllustration } from "@/components/auth/auth-illustration";
import {
    AuthFooterLink,
    AuthHeading,
    AuthScreen,
} from "@/components/auth/auth-screen";
import { authGreeting } from "@/components/auth/auth-screen-utils";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { Spacing, TouchTarget, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePendingAction } from "@/hooks/use-pending-action";
import { friendlyError } from "@/lib/errors";
import {
    loginUser
} from "@/lib/firebase/auth-service";
import {
    isSocialRegistrationRequired,
    signInWithApple,
    signInWithGoogle,
} from "@/lib/firebase/social-auth";
import { markOnboardingComplete } from "@/lib/onboarding";
import { loginSchema, parseForm } from "@/lib/validation/form-schemas";
import { useToast } from "@/providers/toast-provider";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [socialProvider, setSocialProvider] = useState<
    "google" | "apple" | null
  >(null);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const [signingIn, handleLogin] = usePendingAction(async () => {
    if (socialProvider) return;
    Keyboard.dismiss();
    const result = parseForm(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    try {
      await loginUser(result.data.email, result.data.password);
      await markOnboardingComplete();
      router.replace("/(marketplace)/(tabs)/home");
    } catch (e) {
      const msg = friendlyError(e, "Could not sign in. Please try again.");
      setErrors({ password: msg });
      toast.error(msg);
    }
  });

  async function finishSocialLogin(
    provider: "google" | "apple",
    signIn: () => Promise<Awaited<ReturnType<typeof signInWithGoogle>>>,
  ) {
    if (socialProvider || signingIn) return;
    setSocialProvider(provider);
    try {
      await signIn();
      await markOnboardingComplete();
      router.replace("/(marketplace)/(tabs)/home");
    } catch (error) {
      if (isSocialRegistrationRequired(error)) {
        toast.info("Choose a role to finish creating your account.");
        router.replace({
          pathname: "/(auth)/register",
          params: { social: "google" },
        });
        return;
      }
      toast.error(friendlyError(error, "Google or Apple Sign-In could not be completed."));
    } finally {
      setSocialProvider(null);
    }
  }

  return (
    <AuthScreen safeTop>
      <AuthIllustration />
      <AuthHeading
        greeting={authGreeting()}
        title="Welcome back"
        subtitle="Please sign in to continue."
      />

      <View style={styles.form}>
        <AuthField
          label="Email"
          leftIcon="email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clearField("email");
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          blurOnSubmit={false}
          error={errors.email}
        />
        <AuthField
          label="Password"
          leftIcon="lock"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clearField("password");
          }}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          placeholder="Password"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={handleLogin}
          error={errors.password}
          rightElement={
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          }
        />

        <View style={styles.metaRow}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              style={({ pressed }) => [
                styles.forgotHit,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        </View>

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={signingIn}
          disabled={socialProvider !== null}
          style={styles.cta}
        />
        <SocialAuthButtons
          appleButtonType="signIn"
          disabled={signingIn}
          pendingProvider={socialProvider}
          onGooglePress={() =>
            finishSocialLogin("google", () => signInWithGoogle())
          }
          onApplePress={() =>
            finishSocialLogin("apple", () => signInWithApple())
          }
        />
      </View>

      <AuthFooterLink
        href="/(auth)/register"
        prompt="Don't have an account?"
        action="Sign Up"
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    maxWidth: 400,
    gap: Spacing.md,
  },
  metaRow: {
    alignItems: "flex-end",
    marginTop: -Spacing.xs,
  },
  forgotHit: {
    minHeight: TouchTarget.minHeight,
    justifyContent: "center",
    paddingHorizontal: Spacing.xs,
  },
  forgotText: {
    ...Typography.bodyMd,
    fontWeight: "600",
  },
  cta: {
    marginTop: Spacing.sm,
    minHeight: 52,
  },
});
