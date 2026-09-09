import { Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from "react-native-reanimated";

import {
  AuthHeading,
  AuthScreen,
} from "@/components/auth/auth-screen";
import { authGreeting } from "@/components/auth/auth-screen-utils";
import { AuthStepIndicator } from "@/components/auth/auth-step-indicator";
import { Button } from "@/components/ui/button";
import { CityField } from "@/components/ui/city-field";
import { CountryField } from "@/components/ui/country-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/ui/media-field";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { ProfileLocationPicker } from "@/components/ui/profile-location-picker";
import {
  Radius,
  Spacing,
  TouchTarget,
  Typography,
} from "@/constants/design-tokens";
import { cityBelongsToCountry } from "@/constants/cities";
import {
  businessTypeFromRegistration,
  createBusinessProfile,
  updateBusinessProfile,
} from "@/features/marketplace/marketplace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { friendlyError } from "@/lib/errors";
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from "@/lib/firebase/storage-service";
import { haptics } from "@/lib/haptics";
import { profileLocationLabel } from "@/lib/location/profile-location";
import { markBusinessProfileOnboardingComplete } from "@/lib/onboarding";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";
import type { ProfileLocation } from "@/types";

const STEP_LABELS = ["Basics", "Photo", "Location", "Contact"] as const;
const TOTAL_STEPS = STEP_LABELS.length;
const DEFAULT_COUNTRY = "Sri Lanka";
const DEFAULT_CITY = "Beruwala";

type StepIndex = 0 | 1 | 2 | 3;

/** Quiet, optional setup for the public business profile created after registration. */
export function BusinessProfileOnboarding() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const toast = useToast();
  const reduceMotion = useReduceMotion();
  const finishingRef = useRef(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [step, setStep] = useState<StepIndex>(0);
  const [businessName, setBusinessName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [logo, setLogo] = useState<LocalMedia | null>(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<ProfileLocation | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState(() => profile?.phone ?? "");

  if (!user) return <Redirect href="/(auth)/login" />;

  if (!profile) {
    return (
      <AuthScreen safeTop>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Getting your profile ready…
        </Text>
      </AuthScreen>
    );
  }

  const signedInUser = user;
  const currentProfile = profile;
  const businessType = businessTypeFromRegistration(currentProfile);
  const enterMs = reduceMotion ? 120 : 220;
  const exitMs = reduceMotion ? 100 : 140;
  const isLastStep = step === TOTAL_STEPS - 1;

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    Keyboard.dismiss();

    try {
      await withLoading(async () => {
        if (businessName.trim() && businessType) {
          let logoUrl: string | null = null;
          if (logo) {
            logoUrl = await uploadLocalMedia(
              logo,
              `businesses/${signedInUser.uid}/logo.${extensionForMedia(logo)}`,
            );
          }

          const businessId = await createBusinessProfile(
            signedInUser.uid,
            currentProfile.displayName || "Owner",
            {
              businessName,
              businessType,
              city: city.trim() || DEFAULT_CITY,
              country: country.trim() || DEFAULT_COUNTRY,
              address,
              location,
              shortDescription:
                shortDescription.trim() ||
                `Gem business in ${city.trim() || DEFAULT_CITY}.`,
              whatsapp: whatsapp || undefined,
              phone: currentProfile.phone || undefined,
            },
          );

          if (logoUrl) {
            await updateBusinessProfile(businessId, { logoUrl });
          }
        }

        await markBusinessProfileOnboardingComplete();
      }, "Setting up your profile…");

      haptics.success();
      router.replace("/(marketplace)/(tabs)/home");
    } catch (error) {
      finishingRef.current = false;
      setIsFinishing(false);
      toast.error(friendlyError(error, "Could not save your profile. Try again."));
    }
  }

  function moveForward() {
    Keyboard.dismiss();
    if (isLastStep) {
      void finish();
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1) as StepIndex);
  }

  function skipStep() {
    haptics.selection();
    if (isLastStep) {
      void finish();
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1) as StepIndex);
  }

  return (
    <AuthScreen safeTop contentContainerStyle={styles.screenContent}>
      <View style={styles.progressRow}>
        <View style={styles.progressIndicator}>
          <AuthStepIndicator
            step={step + 1}
            total={TOTAL_STEPS}
            label={STEP_LABELS[step]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this step"
          accessibilityState={{ disabled: isFinishing }}
          disabled={isFinishing}
          onPress={skipStep}
          style={({ pressed }) => [
            styles.skipButton,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.skipText, { color: colors.primary }]}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View
        key={STEP_LABELS[step]}
        entering={FadeInRight.duration(enterMs)}
        exiting={FadeOutLeft.duration(exitMs)}
        style={styles.step}
      >
        {step === 0 ? (
          <>
            <View
              style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}
            >
              <Icon name="business" size={28} color={colors.onPrimaryContainer} />
            </View>
            <AuthHeading
              greeting={authGreeting()}
              title="Let’s set up your business"
              subtitle="Start with the essentials."
            />
            <View style={styles.form}>
              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Celestial Sapphires"
                leftIcon="business"
                autoCapitalize="words"
                returnKeyType="next"
              />
              <Input
                label="Short intro (optional)"
                value={shortDescription}
                onChangeText={setShortDescription}
                placeholder="What do you specialize in?"
                multiline
                maxLength={120}
                style={styles.textArea}
              />
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View
              style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}
            >
              <Icon name="photo-camera" size={28} color={colors.onPrimaryContainer} />
            </View>
            <AuthHeading
              title="Add a familiar face"
              subtitle="Optional"
            />
            <View style={styles.form}>
              <MediaField
                value={logo}
                onChange={setLogo}
                emptyTitle="Add a logo"
                emptySubtitle="You can always add one later."
                variant="card"
              />
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View
              style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}
            >
              <Icon name="location-on" size={28} color={colors.onPrimaryContainer} />
            </View>
            <AuthHeading
              title="Where are you based?"
              subtitle="You can refine this later."
            />
            <View style={styles.form}>
              <CountryField
                label="Country"
                value={country}
                onChange={(nextCountry) => {
                  setCountry(nextCountry);
                  if (!city) return;
                  void cityBelongsToCountry(city, nextCountry).then((belongs) => {
                    if (!belongs) setCity("");
                  });
                }}
                placeholder="Select country"
              />
              <CityField
                label="City"
                value={city}
                country={country}
                onChange={setCity}
                placeholder="Select city"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose business location on map"
                onPress={() => setLocationPickerOpen(true)}
                style={({ pressed }) => [
                  styles.locationField,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.locationIcon,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  <Icon
                    name="location-on"
                    size={20}
                    color={colors.onPrimaryContainer}
                  />
                </View>
                <View style={styles.locationCopy}>
                  <Text style={[styles.locationTitle, { color: colors.onSurface }]}>Map pin</Text>
                  <Text
                    style={[styles.locationValue, { color: colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {location
                      ? profileLocationLabel(location)
                      : "Choose the exact public location"}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
              <Input
                label="Address (optional)"
                value={address}
                onChangeText={setAddress}
                placeholder="Area or neighborhood"
                leftIcon="home"
              />
            </View>
            <ProfileLocationPicker
              visible={locationPickerOpen}
              value={location}
              onClose={() => setLocationPickerOpen(false)}
              onSave={(next) => {
                setLocation(next);
                if (next.city) setCity(next.city);
                if (next.country) setCountry(next.country);
                setLocationPickerOpen(false);
              }}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View
              style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}
            >
              <Icon name="chat" size={28} color={colors.onPrimaryContainer} />
            </View>
            <AuthHeading
              title="Let people reach you"
              subtitle="Optional"
            />
            <View style={styles.form}>
              <PhoneNumberField
                label="WhatsApp"
                value={whatsapp}
                onChangeText={setWhatsapp}
                appearance="pill"
                placeholder="WhatsApp number"
              />
            </View>
          </>
        ) : null}
      </Animated.View>

      <View style={styles.footer}>
        <Button
          title={isLastStep ? "Finish" : "Continue"}
          icon={isLastStep ? "check" : "arrow-forward"}
          haptic={isLastStep ? "commit" : "selection"}
          loading={isFinishing}
          onPress={moveForward}
          style={styles.cta}
        />
        <Text style={[styles.footerHint, { color: colors.textMuted }]}>
          You can finish the rest from your profile.
        </Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "flex-start",
    gap: Spacing.xl,
  },
  progressRow: {
    width: "100%",
    maxWidth: 400,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressIndicator: {
    flex: 1,
  },
  skipButton: {
    minHeight: TouchTarget.minHeight,
    justifyContent: "center",
    paddingHorizontal: Spacing.xs,
  },
  skipText: {
    ...Typography.bodyMd,
    fontWeight: "700",
  },
  step: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.lg,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    width: "100%",
    maxWidth: 400,
    gap: Spacing.md,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  locationField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderCurve: "continuous",
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  locationTitle: {
    ...Typography.labelMd,
    fontWeight: "600",
  },
  locationValue: {
    ...Typography.caption,
    lineHeight: 17,
  },
  footer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: Spacing.sm,
  },
  cta: {
    width: "100%",
    minHeight: 52,
  },
  footerHint: {
    ...Typography.caption,
    textAlign: "center",
  },
  loadingText: {
    ...Typography.bodyMd,
  },
});
