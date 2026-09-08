import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'gemfort_onboarding_complete';
const BUSINESS_PROFILE_ONBOARDING_KEY = 'gemfort_business_profile_onboarding_complete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
}

export async function markBusinessProfileOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(BUSINESS_PROFILE_ONBOARDING_KEY, '1');
}

export async function clearOnboardingState(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ONBOARDING_KEY),
    SecureStore.deleteItemAsync(BUSINESS_PROFILE_ONBOARDING_KEY),
  ]);
}
