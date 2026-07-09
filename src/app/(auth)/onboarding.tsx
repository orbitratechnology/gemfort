import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/brand-mark';
import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { Brand, OnboardingChapters } from '@/constants/brand-story';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { markOnboardingComplete } from '@/lib/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = page === OnboardingChapters.length - 1;

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPage(next);
  }

  async function finish(path: '/(auth)/register' | '/(auth)/login' | '/(marketplace)/(tabs)/home') {
    await markOnboardingComplete();
    if (path === '/(marketplace)/(tabs)/home') {
      router.replace(path);
    } else {
      router.push(path);
    }
  }

  function handleContinue() {
    if (isLast) return;
    listRef.current?.scrollToIndex({ index: page + 1, animated: true });
    setPage(page + 1);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <BrandMark size="lg" showWordmark />
        <Text style={[styles.tagline, { color: colors.textMuted }]}>{Brand.tagline}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={OnboardingChapters}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width: SCREEN_WIDTH - Spacing.xxl * 2 }]}>
            <StoryChapter
              step={index + 1}
              total={OnboardingChapters.length}
              title={item.title}
              body={item.body}
              accent={item.accent === 'gold' ? 'accent' : item.accent === 'verified' ? 'success' : 'primary'}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.dots}>
        {OnboardingChapters.map((chapter, i) => (
          <Pressable
            key={chapter.id}
            onPress={() => {
              listRef.current?.scrollToIndex({ index: i, animated: true });
              setPage(i);
            }}
            accessibilityLabel={`Chapter ${i + 1}`}
            style={[
              styles.dot,
              {
                backgroundColor: i === page ? colors.primary : colors.border,
                width: i === page ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {isLast ? (
          <>
            <Button title="Create Account" icon="person-add" onPress={() => finish('/(auth)/register')} />
            <Button title="Sign In" icon="login" variant="secondary" onPress={() => finish('/(auth)/login')} />
            <Button
              title="Browse as Guest"
              icon="explore"
              variant="ghost"
              onPress={() => finish('/(marketplace)/(tabs)/home')}
            />
          </>
        ) : (
          <Button title="Continue" icon="arrow-forward" onPress={handleContinue} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },
  tagline: {
    ...Typography.body,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.xxl,
    alignItems: 'flex-start',
  },
  page: {
    paddingTop: Spacing.section,
    minHeight: 220,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: Radius.full,
  },
  actions: {
    padding: Spacing.xxl,
    gap: Spacing.md,
    paddingBottom: Spacing.section,
  },
});
