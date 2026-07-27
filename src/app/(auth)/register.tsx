import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    FadeInLeft,
    FadeInRight,
    FadeOutLeft,
    FadeOutRight,
} from "react-native-reanimated";

import { AuthField } from "@/components/auth/auth-field";
import { AuthIllustration } from "@/components/auth/auth-illustration";
import {
    AuthFooterLink,
    AuthHeading,
    AuthScreen,
    authGreeting,
} from "@/components/auth/auth-screen";
import { AuthStepIndicator } from "@/components/auth/auth-step-indicator";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { RegisterRoleCards } from "@/components/auth/register-role-cards";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import {
    Motion,
    Radius,
    Spacing,
    TouchTarget,
    Typography,
} from "@/constants/design-tokens";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { friendlyError } from "@/lib/errors";
import { registerUser } from "@/lib/firebase/auth-service";
import { haptics } from "@/lib/haptics";
import { parseForm, registerSchema } from "@/lib/validation/form-schemas";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { UserRole } from "@/types";

type Step = "role" | "form";

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState<Step>("role");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function goToForm() {
    if (!role) {
      setErrors({ role: "Choose a role to continue." });
      toast.error("Choose a role to continue.");
      return;
    }
    clearField("role");
    haptics.selection();
    setStep("form");
  }

  function goToRole() {
    haptics.selection();
    setStep("role");
  }

  async function handleRegister() {
    Keyboard.dismiss();
    if (!role) {
      setStep("role");
      setErrors({ role: "Choose a role to continue." });
      return;
    }

    const result = parseForm(registerSchema, {
      displayName,
      email,
      phone,
      password,
      role,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(
        Object.values(result.errors)[0] ?? "Check the highlighted fields.",
      );
      return;
    }

    setErrors({});
    try {
      await withLoading(async () => {
        const data = result.data;
        const { phone: verifiedPhone } = await registerUser({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
          phone: data.phone,
          role: data.role,
        });
        router.replace({
          pathname: "/(auth)/verify-otp",
          params: { phone: verifiedPhone },
        });
      }, "Creating account…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not create account. Try again."));
    }
  }

  const enterMs = reduceMotion ? Motion.fast : Motion.normal;
  const exitMs = Math.round(enterMs * 0.65);
  const roleLabel = role ? ROLE_LABELS[role] : "";
  const continueTitle = role ? `Continue as ${roleLabel}` : "Continue";

  return (
    <AuthScreen safeTop contentContainerStyle={styles.screenContent}>
      {step === "role" ? (
        <Animated.View
          key="role"
          style={styles.step}
          entering={FadeInLeft.duration(enterMs)}
          exiting={FadeOutLeft.duration(exitMs)}
        >
          <AuthIllustration size={72} />
          <AuthStepIndicator step={1} total={2} label="Your role" />
          <AuthHeading greeting={authGreeting()} title="What role suits you?" />

          <View style={styles.form}>
            <RegisterRoleCards
              value={role}
              onChange={(v) => {
                setRole(v);
                clearField("role");
              }}
              error={errors.role}
            />
            <Button
              title={continueTitle}
              icon="arrow-forward"
              onPress={goToForm}
              disabled={!role}
              accessibilityLabel={
                role
                  ? `Continue as ${roleLabel}`
                  : "Continue. Select a role first"
              }
              style={styles.cta}
            />
          </View>

          <AuthFooterLink
            href="/(auth)/login"
            prompt="Already have an account?"
            action="Sign In"
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="form"
          style={styles.step}
          entering={FadeInRight.duration(enterMs)}
          exiting={FadeOutRight.duration(exitMs)}
        >
          <AuthIllustration size={72} />
          <AuthStepIndicator step={2} total={2} label="Your account" />
          <AuthHeading
            greeting={authGreeting()}
            title="Create your account"
            subtitle="Add your details to finish signing up."
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change role. Currently ${roleLabel}`}
            accessibilityHint="Returns to role selection"
            hitSlop={8}
            onPress={goToRole}
            style={({ pressed }) => [
              styles.roleChip,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="swap-horiz" size={18} color={colors.primary} />
            <Text style={[styles.roleChipText, { color: colors.text }]}>
              {roleLabel}
            </Text>
            <Text style={[styles.roleChipAction, { color: colors.primary }]}>
              Change
            </Text>
          </Pressable>

          <View style={styles.form}>
            <AuthField
              label="Full name"
              leftIcon="person"
              value={displayName}
              onChangeText={(v) => {
                setDisplayName(v);
                clearField("displayName");
              }}
              autoComplete="name"
              textContentType="name"
              error={errors.displayName}
            />
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
              error={errors.email}
            />
            <PhoneNumberField
              label="Mobile number"
              appearance="pill"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                clearField("phone");
              }}
              placeholder="Mobile number"
              error={errors.phone}
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
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="Password"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleRegister}
              error={errors.password}
              rightElement={
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />

            <Button
              title="Sign Up"
              onPress={handleRegister}
              style={styles.cta}
            />
          </View>

          <AuthFooterLink
            href="/(auth)/login"
            prompt="Already have an account?"
            action="Sign In"
          />
        </Animated.View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "flex-start",
  },
  step: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.lg,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    gap: Spacing.md,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: TouchTarget.minHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  roleChipText: {
    ...Typography.bodyMd,
    fontWeight: "700",
    flexShrink: 1,
  },
  roleChipAction: {
    ...Typography.bodyMd,
    fontWeight: "700",
    marginLeft: "auto",
  },
  cta: {
    marginTop: Spacing.sm,
    minHeight: 52,
  },
});
