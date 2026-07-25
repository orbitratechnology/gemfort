import type { OnboardingChapterId } from "@/constants/brand-story";

/**
 * Hero imagery for immersive onboarding.
 *
 * Swap any require to a photo under `assets/images/onboarding/` once you add it.
 */
export const ONBOARDING_HERO_IMAGES: Record<OnboardingChapterId, number> = {
  welcome: require("@/assets/images/onboarding/gems.png"),
  lapidaries: require("@/assets/images/onboarding/gem-cutting.webp"),
  labs: require("@/assets/images/onboarding/gem-lab.jpg"),
  workspace: require("@/assets/images/onboarding/cheques-trips.png"),
  roles: require("@/assets/images/onboarding/orbitratech.png"),
};
