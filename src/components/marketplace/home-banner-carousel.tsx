import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { resolveProfileRole } from '@/constants/roles';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  isNestedWorkspaceHref,
  pushWithAnchor,
} from '@/navigation/tab-stack-nav';
import { useAuth } from '@/providers/auth-provider';
import type { UserRole } from '@/types';

type BannerSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: IconName;
  /** Optional transparent artwork, displayed instead of the oversized icon. */
  image?: number;
  href: Href;
  tone: 'primary' | 'deep' | 'soft';
  /** If set, only these roles see the slide (guests never see them) */
  roles?: UserRole[];
};

type LoopSlide = BannerSlide & {
  key: string;
  realIndex: number;
};

const ALL_BANNERS: BannerSlide[] = [
  {
    id: 'certificate-portals',
    eyebrow: 'Trust',
    title: 'External certificate portals',
    subtitle: 'Open official verification pages before you buy or sell.',
    cta: 'Open portals',
    icon: 'open-in-new',
    href: '/verify-certificate-portals',
    tone: 'primary',
  },
  {
    id: 'market',
    eyebrow: 'Marketplace',
    title: 'Browse gems & traders',
    subtitle: 'Discover verified traders, lapidaries, and new listings.',
    cta: 'Open market',
    icon: 'diamond',
    href: '/(marketplace)/(tabs)/market',
    tone: 'deep',
  },
  {
    id: 'flights',
    eyebrow: 'Travel',
    title: 'Find your next flight',
    subtitle: 'Explore recent fares for your next gem-trade trip.',
    cta: 'Explore flights',
    icon: 'flight',
    image: require('@/assets/images/trips-icon.png'),
    href: '/(marketplace)/(tabs)/workspace/flights',
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
    roles: ['trader', 'admin'],
  },
  {
    id: 'ap',
    eyebrow: 'Network',
    title: 'Give a stone on AP',
    subtitle: 'Hand over inventory with clear return dates.',
    cta: 'Give AP',
    icon: 'handshake',
    href: '/(marketplace)/ap/add',
    tone: 'primary',
    roles: ['trader', 'admin'],
  },
];

const AUTO_MS = 4200;
/** Match ScrollView animated scroll duration before unwrapping clones */
const SCROLL_MS = 300;
const BANNER_HEIGHT = 156;
/** Equal inset on both sides so the active slide is centered (with peek) */
const SIDE_INSET = 32;
const GAP = 12;
const SHADOW_PAD = 6;

/** [lastClone, ...items, firstClone] — seamless forward/back loop */
function buildLoopData(banners: BannerSlide[]): LoopSlide[] {
  const count = banners.length;
  if (count < 2) {
    return banners.map((b, i) => ({ ...b, key: b.id, realIndex: i }));
  }
  const first = banners[0]!;
  const last = banners[count - 1]!;
  return [
    { ...last, key: `${last.id}-clone-start`, realIndex: count - 1 },
    ...banners.map((b, i) => ({ ...b, key: b.id, realIndex: i })),
    { ...first, key: `${first.id}-clone-end`, realIndex: 0 },
  ];
}

function toneFor(
  tone: BannerSlide['tone'],
  colors: ReturnType<typeof useAppTheme>['colors'],
  isDark: boolean,
) {
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
}

/**
 * Full-bleed home carousel with adjacent-slide peek and infinite loop.
 * ScrollView (not FlashList) — few slides, snap is smoother nested in home scroll.
 */
export function HomeBannerCarousel() {
  const { colors, isDark } = useAppTheme();
  const { user, profile } = useAuth();
  const role = resolveProfileRole(profile);
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const pausedRef = useRef(false);
  const programmaticRef = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(0);

  const banners = useMemo(
    () =>
      ALL_BANNERS.filter((b) => {
        if (!b.roles) return true;
        if (!user) return false;
        return b.roles.includes(role);
      }),
    [user, role],
  );
  const count = banners.length;
  const loopData = useMemo(() => buildLoopData(banners), [banners]);
  const startLoopIndex = count < 2 ? 0 : 1;
  const loopRef = useRef(startLoopIndex);
  const countRef = useRef(count);
  const loopDataRef = useRef(loopData);

  const slideWidth = windowWidth - SIDE_INSET * 2;
  const stride = slideWidth + GAP;
  const strideRef = useRef(stride);

  useEffect(() => {
    countRef.current = count;
    loopDataRef.current = loopData;
    strideRef.current = stride;
  });

  function clearTimers() {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    autoTimer.current = null;
    settleTimer.current = null;
  }

  function scrollToLoop(loopIndex: number, animated: boolean) {
    scrollRef.current?.scrollTo({
      x: loopIndex * strideRef.current,
      animated,
    });
  }

  /** Landed on a clone → jump to the matching real slide */
  function settle(rawIndex: number) {
    const n = countRef.current;
    const data = loopDataRef.current;
    if (n < 2) {
      loopRef.current = rawIndex;
      setIndex(rawIndex);
      return;
    }

    let loopIndex = rawIndex;
    if (rawIndex <= 0) {
      loopIndex = n;
      scrollToLoop(loopIndex, false);
    } else if (rawIndex >= n + 1) {
      loopIndex = 1;
      scrollToLoop(loopIndex, false);
    }

    loopRef.current = loopIndex;
    setIndex(data[loopIndex]?.realIndex ?? 0);
  }

  function scheduleAuto() {
    clearTimers();
    if (pausedRef.current || countRef.current < 2) return;
    autoTimer.current = setTimeout(() => {
      const next = loopRef.current + 1;
      programmaticRef.current = true;
      scrollToLoop(next, true);
      settleTimer.current = setTimeout(() => {
        settle(next);
        programmaticRef.current = false;
        scheduleAuto();
      }, SCROLL_MS);
    }, AUTO_MS);
  }

  const carouselConfigKey = `${stride}-${count}-${startLoopIndex}`;
  const [appliedCarouselConfig, setAppliedCarouselConfig] =
    useState(carouselConfigKey);
  if (appliedCarouselConfig !== carouselConfigKey) {
    setAppliedCarouselConfig(carouselConfigKey);
    setIndex(0);
  }

  // Position + auto-play when width (stride) or banner set changes
  useEffect(() => {
    loopRef.current = startLoopIndex;
    scrollToLoop(startLoopIndex, false);
    scheduleAuto();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init on stride / guest vs signed-in set
  }, [stride, count, startLoopIndex]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (programmaticRef.current) return;
    const raw = Math.round(e.nativeEvent.contentOffset.x / strideRef.current);
    settle(raw);
    pausedRef.current = false;
    scheduleAuto();
  }

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        contentOffset={{ x: startLoopIndex * stride, y: 0 }}
        contentContainerStyle={{
          paddingHorizontal: SIDE_INSET,
          paddingVertical: SHADOW_PAD,
        }}
        style={styles.list}
        onScrollBeginDrag={() => {
          pausedRef.current = true;
          clearTimers();
        }}
        onMomentumScrollEnd={onScrollEnd}
      >
        {loopData.map((item) => {
          const tone = toneFor(item.tone, colors, isDark);
          return (
            <View
              key={item.key}
              style={[styles.slideShell, { width: slideWidth, marginRight: GAP }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.cta}`}
                onPress={() => {
                  const href = String(item.href);
                  if (isNestedWorkspaceHref(href)) {
                    pushWithAnchor(item.href);
                    return;
                  }
                  router.push(item.href);
                }}
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
                  <View style={[styles.copy, !!item.image && styles.copyWithImage]}>
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
                {item.image ? (
                  <Image
                    source={item.image}
                    style={styles.artwork}
                    contentFit="contain"
                    pointerEvents="none"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.iconWrap} pointerEvents="none">
                    <Icon name={item.icon} size={88} color={tone.on} />
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots} accessibilityRole="tablist">
        {banners.map((b, i) => {
          const active = i === index;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={`Banner ${i + 1} of ${count}`}
              accessibilityState={{ selected: active }}
              hitSlop={8}
              onPress={() => {
                const loopIndex = count < 2 ? i : i + 1;
                clearTimers();
                programmaticRef.current = true;
                scrollToLoop(loopIndex, true);
                loopRef.current = loopIndex;
                setIndex(i);
                settleTimer.current = setTimeout(() => {
                  programmaticRef.current = false;
                  scheduleAuto();
                }, SCROLL_MS);
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
  slideShell: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
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
  copyWithImage: { maxWidth: '62%' },
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
  artwork: {
    position: 'absolute',
    width: 168,
    height: 126,
    right: -18,
    bottom: -4,
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
