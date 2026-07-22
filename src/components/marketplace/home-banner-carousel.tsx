import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type BannerSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: IconName;
  href: Href;
  tone: 'primary' | 'deep' | 'soft';
};

type LoopSlide = BannerSlide & {
  key: string;
  realIndex: number;
};

const BANNERS: BannerSlide[] = [
  {
    id: 'verify',
    eyebrow: 'Trust',
    title: 'Verify a certificate',
    subtitle: 'Confirm a lab report before you buy or sell.',
    cta: 'Verify now',
    icon: 'verified',
    href: '/verify-certificate',
    tone: 'primary',
  },
  {
    id: 'directory',
    eyebrow: 'Marketplace',
    title: 'Browse gems & traders',
    subtitle: 'Discover verified traders, labs, and new listings.',
    cta: 'Open directory',
    icon: 'diamond',
    href: '/(marketplace)/(tabs)/directory',
    tone: 'deep',
  },
  {
    id: 'cheques',
    eyebrow: 'Workspace',
    title: 'Track your cheques',
    subtitle: 'Maturity dates and clearance, all in one place.',
    cta: 'View cheques',
    icon: 'money-check-dollar',
    href: '/(marketplace)/(tabs)/workspace/cheques',
    tone: 'soft',
  },
  {
    id: 'ap',
    eyebrow: 'Network',
    title: 'Give a stone on AP',
    subtitle: 'Hand over inventory with clear return dates.',
    cta: 'Give AP',
    icon: 'handshake',
    href: '/(marketplace)/(tabs)/workspace/ap/add',
    tone: 'primary',
  },
];

const AUTO_MS = 5200;
const BANNER_HEIGHT = 156;
/** How much of the next/prev slide stays visible */
const PEEK = 36;
const GAP = 12;
/** Vertical inset so card shadows are not clipped by the list */
const SHADOW_PAD = 12;
const COUNT = BANNERS.length;

/** [lastClone, ...items, firstClone] — seamless forward/back loop */
function buildLoopData(): LoopSlide[] {
  if (COUNT < 2) {
    return BANNERS.map((b, i) => ({ ...b, key: b.id, realIndex: i }));
  }
  const first = BANNERS[0]!;
  const last = BANNERS[COUNT - 1]!;
  return [
    { ...last, key: `${last.id}-clone-start`, realIndex: COUNT - 1 },
    ...BANNERS.map((b, i) => ({ ...b, key: b.id, realIndex: i })),
    { ...first, key: `${first.id}-clone-end`, realIndex: 0 },
  ];
}

const LOOP_DATA = buildLoopData();
/** First real slide in loop data (after leading clone) */
const START_LOOP_INDEX = COUNT < 2 ? 0 : 1;

/**
 * Full-bleed home carousel with adjacent-slide peek and infinite loop.
 * Clones bookend the list; after snapping onto a clone we jump to the real slide.
 */
export function HomeBannerCarousel() {
  const { colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<LoopSlide>>(null);
  const loopIndexRef = useRef(START_LOOP_INDEX);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const edge = Spacing.containerMargin;
  const slideWidth = windowWidth - edge - PEEK;
  const stride = slideWidth + GAP;

  const toneStyles = useCallback(
    (tone: BannerSlide['tone']) => {
      switch (tone) {
        case 'deep':
          return {
            bg: colors.tertiary,
            on: colors.onTertiary,
            muted: colors.onTertiary + 'B8',
            chip: colors.onTertiary + '22',
          };
        case 'soft':
          return {
            bg: isDark ? colors.surfaceContainerHigh : colors.primaryContainer,
            on: isDark ? colors.onSurface : colors.onPrimaryContainer,
            muted: isDark ? colors.onSurfaceVariant : colors.onPrimaryContainer + 'CC',
            chip: isDark ? colors.primary + '28' : colors.primary + '18',
          };
        default:
          return {
            bg: colors.primary,
            on: colors.onPrimary,
            muted: colors.onPrimary + 'B8',
            chip: colors.onPrimary + '22',
          };
      }
    },
    [colors, isDark],
  );

  const scrollToLoopIndex = useCallback(
    (loopIndex: number, animated: boolean) => {
      listRef.current?.scrollToOffset({
        offset: loopIndex * stride,
        animated,
      });
    },
    [stride],
  );

  /** Snap landed on a clone → teleport to the matching real slide */
  function settleLoop(rawIndex: number) {
    if (COUNT < 2) {
      loopIndexRef.current = rawIndex;
      setIndex(rawIndex);
      return;
    }

    let loopIndex = rawIndex;
    if (rawIndex <= 0) {
      loopIndex = COUNT;
      scrollToLoopIndex(loopIndex, false);
    } else if (rawIndex >= COUNT + 1) {
      loopIndex = 1;
      scrollToLoopIndex(loopIndex, false);
    }

    loopIndexRef.current = loopIndex;
    setIndex(LOOP_DATA[loopIndex]?.realIndex ?? 0);
  }

  useEffect(() => {
    if (paused || COUNT < 2) return;
    const id = setInterval(() => {
      const next = loopIndexRef.current + 1;
      scrollToLoopIndex(next, true);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [paused, scrollToLoopIndex]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const raw = Math.round(x / stride);
    settleLoop(raw);
  }

  const contentStyle = useMemo(
    () => ({
      paddingHorizontal: edge,
      // Room for card shadows (FlatList otherwise clips them)
      paddingVertical: SHADOW_PAD,
    }),
    [edge],
  );

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={LOOP_DATA}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        disableIntervalMomentum
        removeClippedSubviews={false}
        initialScrollIndex={START_LOOP_INDEX}
        contentContainerStyle={contentStyle}
        style={styles.list}
        getItemLayout={(_, i) => ({
          length: stride,
          offset: stride * i,
          index: i,
        })}
        onScrollBeginDrag={() => setPaused(true)}
        onScrollEndDrag={() => setPaused(false)}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => {
          const tone = toneStyles(item.tone);
          return (
            <View
              style={[
                styles.slideShell,
                {
                  width: slideWidth,
                  marginRight: GAP,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.cta}`}
                onPress={() => router.push(item.href)}
                style={({ pressed }) => [
                  styles.slide,
                  {
                    backgroundColor: tone.bg,
                    opacity: pressed ? 0.94 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={[styles.glow, { backgroundColor: tone.chip }]}
                />
                <View style={styles.copy}>
                  <View style={[styles.eyebrowPill, { backgroundColor: tone.chip }]}>
                    <Text style={[styles.eyebrow, { color: tone.on }]}>
                      {item.eyebrow}
                    </Text>
                  </View>
                  <Text
                    style={[styles.title, { color: tone.on }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: tone.muted }]}
                    numberOfLines={2}
                  >
                    {item.subtitle}
                  </Text>
                  <View style={styles.ctaRow}>
                    <Text style={[styles.cta, { color: tone.on }]}>
                      {item.cta}
                    </Text>
                    <Icon name="arrow-forward" size={16} color={tone.on} />
                  </View>
                </View>
                <View style={styles.iconWrap} pointerEvents="none">
                  <Icon name={item.icon} size={88} color={tone.on} />
                </View>
              </Pressable>
            </View>
          );
        }}
      />

      <View style={styles.dots} accessibilityRole="tablist">
        {BANNERS.map((b, i) => {
          const active = i === index;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={`Banner ${i + 1} of ${COUNT}`}
              accessibilityState={{ selected: active }}
              hitSlop={8}
              onPress={() => {
                const loopIndex = COUNT < 2 ? i : i + 1;
                scrollToLoopIndex(loopIndex, true);
                loopIndexRef.current = loopIndex;
                setIndex(i);
              }}
              style={[
                styles.dot,
                {
                  width: active ? 18 : 7,
                  backgroundColor: active ? colors.primary : colors.outlineVariant,
                },
              ]}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  list: {
    overflow: 'visible',
  },
  /** Outer shell holds the shadow; inner slide clips the glow art. */
  slideShell: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.14)',
  },
  slide: {
    height: BANNER_HEIGHT,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -50,
  },
  copy: {
    flex: 1,
    maxWidth: '72%',
    gap: 6,
    zIndex: 1,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  eyebrow: {
    ...Typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.headlineSmMobile,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    ...Typography.bodyMd,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    minHeight: 28,
  },
  cta: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  iconWrap: {
    position: 'absolute',
    right: 8,
    bottom: -6,
    opacity: 0.18,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.containerMargin,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
