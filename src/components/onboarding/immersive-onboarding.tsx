import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { OnboardingSlide } from '@/components/onboarding/onboarding-slide';
import { OnboardingChapters } from '@/constants/brand-story';
import { haptics } from '@/lib/haptics';
import { markOnboardingComplete } from '@/lib/onboarding';

type ExitPath = '/(auth)/register' | '/(auth)/login' | '/(marketplace)/(tabs)/home';

export function ImmersiveOnboarding() {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const total = OnboardingChapters.length;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setPage(Math.max(0, Math.min(next, total - 1)));
    },
    [total, width],
  );

  const finish = useCallback(async (path: ExitPath) => {
    await markOnboardingComplete();
    if (path === '/(marketplace)/(tabs)/home') {
      router.replace(path);
    } else {
      router.push(path);
    }
  }, []);

  const goTo = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
      setPage(index);
    },
    [width],
  );

  const handleContinue = useCallback(() => {
    haptics.selection();
    if (page >= total - 1) {
      void finish('/(marketplace)/(tabs)/home');
      return;
    }
    goTo(Math.min(page + 1, total - 1));
  }, [finish, goTo, page, total]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }} accessibilityLabel="GemFort onboarding">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        decelerationRate="fast">
        {OnboardingChapters.map((chapter, index) => (
          <OnboardingSlide
            key={chapter.id}
            chapter={chapter}
            index={index}
            total={total}
            width={width}
            height={height}
            isActive={page === index}
            onContinue={handleContinue}
            onCreateAccount={() => {
              haptics.commit();
              void finish('/(auth)/register');
            }}
            onSignIn={() => {
              haptics.selection();
              void finish('/(auth)/login');
            }}
            onBrowseGuest={() => {
              haptics.selection();
              void finish('/(marketplace)/(tabs)/home');
            }}
            onSkip={() => {
              haptics.selection();
              void finish('/(marketplace)/(tabs)/home');
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
