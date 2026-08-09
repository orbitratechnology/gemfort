import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Business } from '@/types';

type BusinessPhoto = Business['galleryPhotos'][number];

type LoopSlide = {
  key: string;
  photo: BusinessPhoto;
  realIndex: number;
};

const AUTO_MS = 3600;
const SCROLL_MS = 300;
const SIDE_INSET = Spacing.containerMargin;
const GAP = 12;
const SHADOW_PAD = 6;

function buildLoopData(photos: BusinessPhoto[]): LoopSlide[] {
  const count = photos.length;
  if (count < 2) {
    return photos.map((p, i) => ({ key: p.photoId, photo: p, realIndex: i }));
  }
  const first = photos[0]!;
  const last = photos[count - 1]!;
  return [
    { key: `${last.photoId}-clone-start`, photo: last, realIndex: count - 1 },
    ...photos.map((p, i) => ({ key: p.photoId, photo: p, realIndex: i })),
    { key: `${first.photoId}-clone-end`, photo: first, realIndex: 0 },
  ];
}

/**
 * Auto-scrolling business gallery carousel — seamless infinite loop with an
 * adjacent-slide peek (same loop technique as HomeBannerCarousel). Tapping a
 * photo opens a fullscreen swipeable viewer. Pauses while the user drags.
 */
export function BusinessGalleryCarousel({
  photos,
  aspectRatio = 16 / 9,
  autoMs = AUTO_MS,
}: {
  photos: BusinessPhoto[];
  aspectRatio?: number;
  autoMs?: number;
}) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const pausedRef = useRef(false);
  const programmaticRef = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const count = photos.length;
  const loopData = useMemo(() => buildLoopData(photos), [photos]);
  const startLoopIndex = count < 2 ? 0 : 1;
  const loopRef = useRef(startLoopIndex);
  const countRef = useRef(count);
  const loopDataRef = useRef(loopData);

  const slideWidth = windowWidth - SIDE_INSET * 2;
  const slideHeight = Math.round(slideWidth / aspectRatio);
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

  /** Landed on a clone → jump to the matching real slide (seamless loop). */
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
    if (pausedRef.current || countRef.current < 2 || autoMs <= 0) return;
    autoTimer.current = setTimeout(() => {
      const next = loopRef.current + 1;
      programmaticRef.current = true;
      scrollToLoop(next, true);
      settleTimer.current = setTimeout(() => {
        settle(next);
        programmaticRef.current = false;
        scheduleAuto();
      }, SCROLL_MS);
    }, autoMs);
  }

  const carouselConfigKey = `${stride}-${count}-${startLoopIndex}`;
  const [appliedConfig, setAppliedConfig] = useState(carouselConfigKey);
  if (appliedConfig !== carouselConfigKey) {
    setAppliedConfig(carouselConfigKey);
    setIndex(0);
  }

  useEffect(() => {
    loopRef.current = startLoopIndex;
    scrollToLoop(startLoopIndex, false);
    scheduleAuto();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init on width/photo-set changes
  }, [stride, count, startLoopIndex, autoMs]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (programmaticRef.current) return;
    const raw = Math.round(e.nativeEvent.contentOffset.x / strideRef.current);
    settle(raw);
    pausedRef.current = false;
    scheduleAuto();
  }

  function openViewer(at: number) {
    setViewerIndex(at);
    setViewerOpen(true);
  }

  if (count === 0) return null;

  return (
    <View style={styles.wrap}>
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
        {loopData.map((item) => (
          <View
            key={item.key}
            style={[styles.slideShell, { width: slideWidth, marginRight: GAP }]}
          >
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${item.realIndex + 1} of ${count}. Tap to view full screen`}
              onPress={() => openViewer(item.realIndex)}
              style={({ pressed }) => [
                styles.slide,
                {
                  height: slideHeight,
                  backgroundColor: colors.surfaceContainerHigh,
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
            >
              <Image
                source={{ uri: item.photo.url }}
                style={styles.image}
                contentFit="cover"
                recyclingKey={item.photo.url}
                transition={200}
              />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={styles.metaRow}>
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <Pressable
              key={p.photoId}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1} of ${count}`}
              accessibilityState={{ selected: i === index }}
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
                  width: i === index ? 18 : 7,
                  backgroundColor:
                    i === index ? colors.primary : colors.outlineVariant,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {String(index + 1).padStart(2, '0')} /{' '}
            {String(count).padStart(2, '0')}
          </Text>
        </View>
      </View>

      <Modal
        visible={viewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerOpen(false)}
        statusBarTranslucent
      >
        <View style={[styles.viewer, { backgroundColor: '#000' }]}>
          <Pressable
            onPress={() => setViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            hitSlop={12}
            style={[
              styles.closeBtn,
              { top: insets.top + 8, right: Math.max(insets.right, 16) },
            ]}
          >
            <Icon name="close" size={26} color="#fff" />
          </Pressable>

          <Text
            style={[
              styles.viewerCount,
              { top: insets.top + 14, color: 'rgba(255,255,255,0.85)' },
            ]}
          >
            {viewerIndex + 1} / {count}
          </Text>

          <ScrollView
            horizontal
            pagingEnabled
            style={styles.viewerPager}
            contentOffset={{ x: viewerIndex * windowWidth, y: 0 }}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const w = e.nativeEvent.layoutMeasurement.width || 1;
              setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / w));
            }}
          >
            {photos.map((p) => (
              <View key={p.photoId} style={{ width: windowWidth, height: '100%' }}>
                <Image
                  source={{ uri: p.url }}
                  style={styles.viewerImage}
                  contentFit="contain"
                  recyclingKey={`full-${p.url}`}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  list: {
    overflow: 'visible',
  },
  slideShell: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
  },
  slide: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 4,
    gap: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  countPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  countText: {
    ...Typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  viewer: { flex: 1 },
  viewerPager: { flex: 1 },
  viewerImage: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerCount: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 2,
    ...Typography.labelMd,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
