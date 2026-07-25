import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { OnboardingChapterId } from '@/constants/brand-story';
import { ONBOARDING_HERO_IMAGES } from '@/constants/onboarding-media';

type OnboardingHeroProps = {
  chapterId: OnboardingChapterId;
  width: number;
  height: number;
};

/** Full-bleed hero photo / gem illustration for immersive onboarding. */
export function OnboardingHero({ chapterId, width, height }: OnboardingHeroProps) {
  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Image
        source={ONBOARDING_HERO_IMAGES[chapterId]}
        style={{ width, height }}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.88) 72%, #000000 100%)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#000000',
  },
});
