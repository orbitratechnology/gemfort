import type { OnboardingChapterId } from "@/constants/brand-story";

/**
 * Hero imagery for immersive onboarding.
 *
 * Swap any require to a photo under `assets/images/onboarding/` once you add it.
 */
export const ONBOARDING_HERO_IMAGES: Record<OnboardingChapterId, number> = {
  welcome: require("@/assets/images/onboarding/gems.webp"),
  lapidaries: require("@/assets/images/onboarding/gem-cutting.webp"),
  workspace: require("@/assets/images/onboarding/cheques-trips.webp"),
  roles: require("@/assets/images/onboarding/orbitratech.webp"),
};
