import { router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/* Reanimated SharedValue `.value` writes are intentional in this file. */
/* eslint-disable react-hooks/immutability */

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CountryFlag } from "@/components/ui/country-flag";
import { Icon } from "@/components/ui/icon";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  buildActiveProgressItems,
  type ActiveProgressItem,
} from "@/features/workspace/active-progress";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";
import type { ApRecord, Bill, Cheque, ServiceRecord, Trip } from "@/types";

/** High enough to list every ongoing item in the long-press sheet. */
const ALL_ITEMS_LIMIT = 100;

type ActiveProgressStripProps = {
  trips: Trip[];
  apRecords: ApRecord[];
  cheques: Cheque[];
  bills?: Bill[];
  services?: ServiceRecord[];
  currentUid?: string | null;
  contactName: (id: string | null | undefined) => string;
  contactPhoto?: (id: string | null | undefined) => string | null;
  businessPhoto?: (id: string | null | undefined) => string | null;
  ownerBusinessPhoto?: (uid: string | null | undefined) => string | null;
  apImage?: (record: ApRecord) => {
    url: string | null;
    shape: "circle" | "rounded";
  } | null;
  /** Max cards in the deck. */
  limit?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SWIPE_THRESHOLD = 72;
const STACK_VISIBLE = 3;
const FLY_OUT = 280;
const SETTLE_MS = 180;

const ProgressCardFace = memo(function ProgressCardFace({
  item,
  compact,
  colors,
}: {
  item: ActiveProgressItem;
  compact?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const tone = item.overdue ? colors.error : colors.primary;
  const thumbSize = compact ? 30 : 34;
  const imageUrl = item.imageUrl?.trim() || null;
  const showPartyAvatar = item.kind !== "trip";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 8 : Spacing.sm,
        paddingVertical: compact ? 10 : Spacing.md,
        paddingHorizontal: compact ? 12 : Spacing.md,
        minHeight: compact ? 64 : 76,
      }}
    >
      {imageUrl && item.imageShape === "rounded" ? (
        <GemThumb
          uri={imageUrl}
          label={item.title}
          size={thumbSize}
          radius={10}
        />
      ) : showPartyAvatar ? (
        <ContactAvatar
          name={item.title}
          photoUrl={imageUrl}
          size={thumbSize}
        />
      ) : (
        <View
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: 10,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primaryContainer,
          }}
        >
          <Icon
            name={item.icon}
            size={compact ? 15 : 18}
            color={colors.onPrimaryContainer}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <Text
            style={{
              ...Typography.caption,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.3,
              color: tone,
            }}
            numberOfLines={1}
          >
            {item.badge}
          </Text>
          <Text
            style={{
              ...Typography.labelMd,
              fontWeight: "600",
              flexShrink: 1,
              color: colors.onSurface,
            }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexShrink: 1,
          }}
        >
          {item.country ? (
            <CountryFlag country={item.country} size="xs" />
          ) : null}
          <Text
            style={{
              ...Typography.caption,
              color: colors.textMuted,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            overflow: "hidden",
            width: "100%",
            backgroundColor: colors.surfaceContainerHigh,
          }}
        >
          <View
            style={{
              height: "100%",
              borderRadius: 2,
              width: `${item.progress}%`,
              backgroundColor: tone,
            }}
          />
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text
          style={{ ...Typography.caption, fontWeight: "700", color: tone }}
          numberOfLines={1}
        >
          {item.when}
        </Text>
        <Icon
          name={item.icon}
          size={compact ? 14 : 16}
          color={colors.onSurfaceVariant}
        />
      </View>
    </View>
  );
});

const StackedCard = memo(function StackedCard({
  item,
  depth,
  compact,
  isFront,
  translateX,
  surfaceColor,
}: {
  item: ActiveProgressItem;
  depth: number;
  compact?: boolean;
  isFront: boolean;
  translateX: SharedValue<number>;
  surfaceColor: string;
}) {
  const { colors } = useAppTheme();
  const peekY = compact ? 7 : 9;

  const animatedStyle = useAnimatedStyle(() => {
    if (isFront) {
      const x = translateX.value;
      const rotate = interpolate(
        x,
        [-160, 0, 160],
        [-8, 0, 8],
        Extrapolation.CLAMP,
      );
      return {
        transform: [
          { translateX: x },
          { translateY: 0 },
          { scale: 1 },
          { rotate: `${rotate}deg` },
        ],
        opacity: interpolate(
          Math.abs(x),
          [0, 140],
          [1, 0.55],
          Extrapolation.CLAMP,
        ),
      };
    }

    const pull = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: 0 },
        { translateY: depth * peekY * (1 - pull) },
        { scale: 1 - depth * 0.045 + pull * 0.045 },
        { rotate: "0deg" },
      ],
      opacity: 1 - depth * 0.18,
    };
  }, [isFront, depth, peekY]);

  return (
    <Animated.View
      pointerEvents={isFront ? "box-none" : "none"}
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          zIndex: 10 - depth,
          borderRadius: compact ? Radius.lg : Radius.xl,
          borderCurve: "continuous",
          backgroundColor: surfaceColor,
          borderWidth: item.overdue ? 1 : 0,
          borderColor: item.overdue ? colors.error + "44" : "transparent",
        },
        animatedStyle,
      ]}
    >
      <ProgressCardFace item={item} compact={compact} colors={colors} />
    </Animated.View>
  );
});

export function ActiveProgressStrip({
  trips,
  apRecords,
  cheques,
  bills = [],
  services = [],
  currentUid,
  contactName,
  contactPhoto,
  businessPhoto,
  ownerBusinessPhoto,
  apImage,
  limit = 6,
  compact = false,
  style,
}: ActiveProgressStripProps) {
  const { colors } = useAppTheme();
  const allItems = useMemo(
    () =>
      buildActiveProgressItems({
        trips,
        apRecords,
        cheques,
        bills,
        services,
        currentUid,
        contactName,
        contactPhoto,
        businessPhoto,
        ownerBusinessPhoto,
        apImage,
        limit: ALL_ITEMS_LIMIT,
      }),
    [
      trips,
      apRecords,
      cheques,
      bills,
      services,
      currentUid,
      contactName,
      contactPhoto,
      businessPhoto,
      ownerBusinessPhoto,
      apImage,
    ],
  );
  const items = useMemo(
    () => allItems.slice(0, limit),
    [allItems, limit],
  );

  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const translateX = useSharedValue(0);
  const count = items.length;
  const deckIndex = count > 0 ? index % count : 0;

  const advance = useCallback(
    (dir: 1 | -1) => {
      if (count <= 1) return;
      haptics.selection();
      setIndex((i) => (i + dir + count) % count);
      translateX.value = 0;
    },
    [count, translateX],
  );

  const openList = useCallback(() => {
    haptics.longPress();
    setListOpen(true);
  }, []);
  const closeList = useCallback(() => setListOpen(false), []);

  const openFront = useCallback(() => {
    const item = items[deckIndex];
    if (!item) return;
    haptics.light();
    router.push(item.href as never);
  }, [items, deckIndex]);

  const openListed = useCallback((href: string) => {
    haptics.selection();
    setListOpen(false);
    router.push(href as never);
  }, []);

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldSwipe =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > 700;
      if (!shouldSwipe) {
        translateX.value = withTiming(0, { duration: SETTLE_MS });
        return;
      }
      const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
      const fly = dir === 1 ? -FLY_OUT : FLY_OUT;
      translateX.value = withTiming(fly, { duration: 140 }, (finished) => {
        if (!finished) return;
        runOnJS(advance)(dir);
      });
    });

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .maxDistance(14)
    .onStart(() => {
      runOnJS(openList)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(openFront)();
  });

  const composed = Gesture.Exclusive(pan, longPress, tap);

  if (count === 0) return null;

  const visible = Array.from(
    { length: Math.min(STACK_VISIBLE, count) },
    (_, depth) => ({
      item: items[(deckIndex + depth) % count]!,
      depth,
    }),
  );

  // Fixed height so swipes don't thrash layout when the front card identity changes.
  const cardHeight = compact ? 64 : 76;
  const peekPad = count > 1 ? (compact ? 16 : 20) : 0;
  const surfaceColor = colors.surfaceContainerLowest;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={[{ gap: 8 }, style]}>
      <GestureDetector gesture={composed}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Ongoing progress. Long press to see all."
          accessibilityHint="Swipe to browse. Long press for the full list."
          style={{ height: cardHeight + peekPad }}
        >
          {visible
            .slice()
            .reverse()
            .map(({ item, depth }) => (
              <StackedCard
                key={item.id}
                item={item}
                depth={depth}
                compact={compact}
                isFront={depth === 0}
                translateX={translateX}
                surfaceColor={surfaceColor}
              />
            ))}
        </View>
      </GestureDetector>

      {count > 1 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          accessibilityRole="adjustable"
          accessibilityLabel={`Ongoing item ${deckIndex + 1} of ${count}`}
        >
          {items.map((item, i) => {
            const active = i === deckIndex;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${item.badge}`}
                onPress={() => {
                  translateX.value = 0;
                  setIndex(i);
                }}
                onLongPress={openList}
                delayLongPress={400}
                hitSlop={6}
                style={{
                  width: active ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: active
                    ? colors.primary
                    : colors.outlineVariant,
                }}
              />
            );
          })}
        </View>
      ) : null}

      <BottomSheet
        visible={listOpen}
        onClose={closeList}
        title={`Ongoing · ${allItems.length}`}
      >
        <View style={{ gap: Spacing.sm }}>
          {allItems.map((item) => {
            const tone = item.overdue ? colors.error : colors.primary;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.badge}. ${item.title}. ${item.when}`}
                onPress={() => openListed(item.href)}
                style={({ pressed }) => ({
                  borderRadius: Radius.lg,
                  borderCurve: "continuous",
                  backgroundColor: colors.surfaceContainerLow,
                  borderWidth: item.overdue ? 1 : 0,
                  borderColor: item.overdue ? tone + "44" : "transparent",
                  opacity: pressed ? 0.92 : 1,
                  overflow: "hidden",
                })}
              >
                <ProgressCardFace
                  item={item}
                  compact
                  colors={colors}
                />
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </Animated.View>
  );
}

export type { ActiveProgressItem };
