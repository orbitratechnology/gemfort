import { StatusBar } from 'expo-status-bar';

import { ImmersiveOnboarding } from '@/components/onboarding/immersive-onboarding';

export default function OnboardingScreen() {
  return (
    <>
      <StatusBar style="light" />
      <ImmersiveOnboarding />
    </>
  );
}
