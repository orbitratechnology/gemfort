import { Stack } from "expo-router";

import { BusinessProfileOnboarding } from "@/components/onboarding/business-profile-onboarding";

export default function BusinessOnboardingScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Set up your business",
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <BusinessProfileOnboarding />
    </>
  );
}
