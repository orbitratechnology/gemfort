import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import {
    Keyboard,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import { AuthField } from "@/components/auth/auth-field";
import { AuthIllustration } from "@/components/auth/auth-illustration";
import {
    AuthFooterLink,
    AuthHeading,
    AuthScreen,
    authGreeting,
} from "@/components/auth/auth-screen";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { Spacing, TouchTarget, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
    loadRememberedEmail,
    saveRememberedEmail,
} from "@/lib/auth/remember-email";
import { friendlyError } from "@/lib/errors";
import {
    getUserProfile,
    loginUser,
    needsPhoneVerification,
} from "@/lib/firebase/auth-service";
import {
  isSocialRegistrationRequired,
  signInWithApple,
  signInWithGoogle,
} from "@/lib/firebase/social-auth";
import { haptics } from "@/lib/haptics";
import { markOnboardingComplete } from "@/lib/onboarding";
import { loginSchema, parseForm } from "@/lib/validation/form-schemas";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadRememberedEmail().then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

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

    setErrors({});
    try {
      await withLoading(async () => {
        const loggedInUser = await loginUser(
          result.data.email,
          result.data.password,
        );
        await saveRememberedEmail(rememberMe ? result.data.email : null);
        await markOnboardingComplete();
        const profile = await getUserProfile(loggedInUser.uid);
        if (needsPhoneVerification(profile)) {
          router.replace(
            profile?.phone
              ? {
                  pathname: "/(auth)/verify-otp",
                  params: { phone: profile.phone },
                }
              : "/(auth)/complete-phone",
          );
        } else {
          router.replace("/(marketplace)/(tabs)/home");
        }
      }, "Signing in…");
    } catch (e) {
      const msg = friendlyError(e, "Could not sign in. Please try again.");
      setErrors({ password: msg });
      toast.error(msg);
    }
  }

  async function finishSocialLogin(
    signIn: () => Promise<Awaited<ReturnType<typeof signInWithGoogle>>>,
  ) {
    try {
      await withLoading(async () => {
        const { profile } = await signIn();
        await markOnboardingComplete();
        if (needsPhoneVerification(profile)) {
          router.replace("/(auth)/complete-phone");
        } else {
          router.replace("/(marketplace)/(tabs)/home");
        }
      }, "Signing in...");
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

        <View style={styles.rememberRow}>
          <Text style={[styles.rememberLabel, { color: colors.textSecondary }]}>
            Remember me next time
          </Text>
          <Switch
            value={rememberMe}
            onValueChange={(v) => {
              haptics.selection();
              setRememberMe(v);
            }}
            trackColor={{
              false: colors.surfaceContainerHighest,
              true: colors.primary,
            }}
            thumbColor={colors.background}
            accessibilityLabel="Remember me next time"
          />
        </View>

        <Button title="Sign In" onPress={handleLogin} style={styles.cta} />
        <SocialAuthButtons
          appleButtonType="signIn"
          onGooglePress={() => finishSocialLogin(() => signInWithGoogle())}
          onApplePress={() => finishSocialLogin(() => signInWithApple())}
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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: TouchTarget.minHeight,
    gap: Spacing.md,
  },
  rememberLabel: {
    ...Typography.bodyMd,
    flex: 1,
  },
  cta: {
    marginTop: Spacing.sm,
    minHeight: 52,
  },
});
