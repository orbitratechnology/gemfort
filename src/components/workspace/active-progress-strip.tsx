import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  buildActiveProgressItems,
  type ActiveProgressItem,
} from "@/features/workspace/active-progress";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { ApRecord, Cheque, Trip } from "@/types";

type ActiveProgressStripProps = {
  trips: Trip[];
  apRecords: ApRecord[];
  cheques: Cheque[];
  contactName: (id: string | null | undefined) => string;
  /** Max cards in the deck. */
  limit?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SWIPE_THRESHOLD = 72;
const STACK_VISIBLE = 3;
const SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

function ProgressCardFace({
  item,
  compact,
  colors,
}: {
  item: ActiveProgressItem;
  compact?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const tone = item.overdue ? colors.error : colors.primary;

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
      <View
        style={{
          width: compact ? 30 : 34,
          height: compact ? 30 : 34,
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
        <Text
          style={{ ...Typography.caption, color: colors.textMuted }}
          numberOfLines={1}
        >
          {item.subtitle}
        </Text>
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
      <View style={{ alignItems: "flex-end", gap: 2, maxWidth: 88 }}>
        <Text
          style={{ ...Typography.caption, fontWeight: "700", color: tone }}
          numberOfLines={1}
        >
          {item.when}
        </Text>
        <Text
          style={{
            ...Typography.caption,
            fontSize: 11,
            color: colors.textMuted,
          }}
          numberOfLines={1}
        >
          {item.dateLabel}
        </Text>
      </View>
    </View>
  );
}

function StackedCard({
  item,
  depth,
  compact,
  isFront,
  translateX,
  onPress,
}: {
  item: ActiveProgressItem;
  depth: number;
  compact?: boolean;
  isFront: boolean;
  translateX: SharedValue<number>;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const toneBorder = item.overdue ? colors.error + "44" : "transparent";

  const animatedStyle = useAnimatedStyle(() => {
    if (isFront) {
      const x = translateX.value;
      const rotate = interpolate(
        x,
        [-160, 0, 160],
        [-8, 0, 8],
        Extrapolation.CLAMP,
      );
      const opacity = interpolate(
        Math.abs(x),
        [0, 140],
        [1, 0.55],
        Extrapolation.CLAMP,
      );
      return {
        transform: [
          { translateX: x },
          { translateY: 0 },
          { scale: 1 },
          { rotate: `${rotate}deg` },
        ],
        opacity,
        zIndex: 10,
      };
    }

    // Cards behind rise slightly as the front card is dragged away.
    const pull = Math.min(1, Math.abs(translateX.value) / SWIPE_THRESHOLD);
    const baseY = depth * (compact ? 7 : 9);
    const baseScale = 1 - depth * 0.045;
    const y = baseY - pull * (compact ? 7 : 9);
    const scale = baseScale + pull * 0.045;

    return {
      transform: [
        { translateX: 0 },
        { translateY: y },
        { scale },
        { rotate: "0deg" },
      ],
      opacity: 1 - depth * 0.18,
      zIndex: 10 - depth,
    };
  });

  return (
    <Animated.View
      pointerEvents={isFront ? "auto" : "none"}
      style={[
        {
          position: depth === 0 ? "relative" : "absolute",
          left: 0,
          right: 0,
          top: 0,
          borderRadius: compact ? Radius.lg : Radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.surfaceContainerLowest,
          borderWidth: item.overdue ? 1 : 0,
          borderColor: toneBorder,
          boxShadow: "0 2px 12px rgba(15, 118, 110, 0.08)",
        },
        animatedStyle,
      ]}
    >
      {isFront ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.badge}. ${item.title}. ${item.when}`}
          onPress={onPress}
          style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}
        >
          <ProgressCardFace item={item} compact={compact} colors={colors} />
        </Pressable>
      ) : (
        <ProgressCardFace item={item} compact={compact} colors={colors} />
      )}
    </Animated.View>
  );
}

export function ActiveProgressStrip({
  trips,
  apRecords,
  cheques,
  contactName,
  limit = 6,
  compact = false,
  style,
}: ActiveProgressStripProps) {
  const { colors } = useAppTheme();
  const items = useMemo(
    () =>
      buildActiveProgressItems({
        trips,
        apRecords,
        cheques,
        contactName,
        limit,
      }),
    [trips, apRecords, cheques, contactName, limit],
  );

  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);

  // Keep index in range when the item list shrinks.
  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  const count = items.length;

  function advance(dir: 1 | -1) {
    if (count <= 1) return;
    setIndex((i) => (i + dir + count) % count);
    translateX.value = 0;
  }

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldSwipe =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > 700;
      if (!shouldSwipe) {
        translateX.value = withSpring(0, SPRING);
        return;
      }
      const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
      const fly = dir === 1 ? -280 : 280;
      translateX.value = withTiming(fly, { duration: 180 }, (finished) => {
        if (!finished) return;
        runOnJS(advance)(dir);
      });
    });

  if (count === 0) return null;

  const visible = Array.from(
    { length: Math.min(STACK_VISIBLE, count) },
    (_, depth) => items[(index + depth) % count]!,
  );

  // Stack peek needs vertical room under the front card.
  const peekPad = count > 1 ? (compact ? 16 : 20) : 0;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={[{ gap: 8 }, style]}>
      <GestureDetector gesture={pan}>
        <View style={{ paddingBottom: peekPad }}>
          {/* Render back → front so z-order is correct without fighting absolute layers */}
          {visible
            .map((item, depth) => ({ item, depth }))
            .reverse()
            .map(({ item, depth }) => (
              <StackedCard
                key={`${item.id}-${depth === 0 ? index : `d${depth}`}`}
                item={item}
                depth={depth}
                compact={compact}
                isFront={depth === 0}
                translateX={translateX}
                onPress={() => router.push(item.href as never)}
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
          accessibilityLabel={`Ongoing item ${index + 1} of ${count}`}
        >
          {items.map((item, i) => {
            const active = i === index;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${item.badge}`}
                onPress={() => {
                  translateX.value = 0;
                  setIndex(i);
                }}
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
    </Animated.View>
  );
}

export type { ActiveProgressItem };
