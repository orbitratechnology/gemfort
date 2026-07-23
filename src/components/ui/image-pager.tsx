import { Image } from "expo-image";
import PagerView from "@expo/ui/community/pager-view";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type ImagePagerProps = {
  urls: string[];
  /** Aspect ratio for the inline hero (default 1). */
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  /** Optional shared-element wrapper for the first page only. */
  wrapFirstPage?: (node: ReactNode) => ReactNode;
  accessibilityLabel?: string;
};

function normalizeUrls(urls: string[]): string[] {
  return urls.map((u) => u.trim()).filter((u) => u.length > 0);
}

/**
 * Swipeable image gallery using Expo's recommended PagerView
 * (`@expo/ui/community/pager-view`) + `expo-image`.
 * Tap opens a fullscreen swipeable viewer.
 */
export function ImagePager({
  urls,
  aspectRatio = 1,
  style,
  wrapFirstPage,
  accessibilityLabel = "Photo gallery",
}: ImagePagerProps) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photos = useMemo(() => normalizeUrls(urls), [urls]);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = useCallback((at: number) => {
    setViewerIndex(at);
    setViewerOpen(true);
  }, []);

  if (photos.length === 0) {
    return (
      <View
        style={[
          styles.hero,
          { aspectRatio, backgroundColor: colors.surfaceContainerHigh },
          style,
        ]}
        accessibilityLabel="No photos"
      >
        <View style={styles.placeholder}>
          <Icon name="diamond" size={48} color={colors.outlineVariant} />
        </View>
      </View>
    );
  }

  const pager = (
    <View
      style={[
        styles.hero,
        { aspectRatio, backgroundColor: colors.surfaceContainerLowest },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {process.env.EXPO_OS === "web" ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const w = e.nativeEvent.layoutMeasurement.width || 1;
            setIndex(Math.round(e.nativeEvent.contentOffset.x / w));
          }}
        >
          {photos.map((uri, i) => {
            const img = (
              <Pressable
                key={uri}
                onPress={() => openViewer(i)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                style={{ width: windowWidth - Spacing.containerMargin * 2 }}
              >
                <Image
                  source={{ uri }}
                  style={styles.image}
                  contentFit="cover"
                  recyclingKey={uri}
                  transition={200}
                />
              </Pressable>
            );
            return i === 0 && wrapFirstPage ? wrapFirstPage(img) : img;
          })}
        </ScrollView>
      ) : (
        <PagerView
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => setIndex(e.nativeEvent.position)}
        >
          {photos.map((uri, i) => {
            const page = (
              <Pressable
                key={uri}
                onPress={() => openViewer(i)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Double tap to view full screen`}
                style={styles.page}
              >
                <Image
                  source={{ uri }}
                  style={styles.image}
                  contentFit="cover"
                  recyclingKey={uri}
                  transition={200}
                />
              </Pressable>
            );
            return i === 0 && wrapFirstPage ? (
              <View key={uri} style={styles.page} collapsable={false}>
                {wrapFirstPage(page)}
              </View>
            ) : (
              page
            );
          })}
        </PagerView>
      )}

      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((uri, i) => (
            <View
              key={uri}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === index ? colors.onPrimary : "rgba(255,255,255,0.45)",
                  opacity: i === index ? 1 : 0.9,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View
          style={[styles.countPill, { backgroundColor: "rgba(0,0,0,0.55)" }]}
          pointerEvents="none"
        >
          <Text style={styles.countText}>
            {index + 1}/{photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      {pager}

      <Modal
        visible={viewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerOpen(false)}
        statusBarTranslucent
      >
        <View style={[styles.viewer, { backgroundColor: "#000" }]}>
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
              { top: insets.top + 14, color: "rgba(255,255,255,0.85)" },
            ]}
          >
            {viewerIndex + 1} / {photos.length}
          </Text>

          {process.env.EXPO_OS === "web" ? (
            <ScrollView
              horizontal
              pagingEnabled
              style={styles.viewerPager}
              contentOffset={{ x: viewerIndex * windowWidth, y: 0 }}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const w = e.nativeEvent.layoutMeasurement.width || 1;
                setViewerIndex(
                  Math.round(e.nativeEvent.contentOffset.x / w),
                );
              }}
            >
              {photos.map((uri) => (
                <View
                  key={uri}
                  style={{ width: windowWidth, height: "100%" }}
                >
                  <Image
                    source={{ uri }}
                    style={styles.viewerImage}
                    contentFit="contain"
                    recyclingKey={`full-${uri}`}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <PagerView
              style={styles.viewerPager}
              initialPage={viewerIndex}
              onPageSelected={(e) =>
                setViewerIndex(e.nativeEvent.position)
              }
            >
              {photos.map((uri) => (
                <View key={uri} style={styles.viewerPage}>
                  <Image
                    source={{ uri }}
                    style={styles.viewerImage}
                    contentFit="contain"
                    recyclingKey={`full-${uri}`}
                  />
                </View>
              ))}
            </PagerView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
  },
  pager: { flex: 1 },
  page: { flex: 1 },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  countPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  countText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  viewer: { flex: 1 },
  viewerPager: { flex: 1 },
  viewerPage: { flex: 1 },
  viewerImage: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  viewerCount: {
    position: "absolute",
    alignSelf: "center",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: 2,
    ...Typography.labelMd,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
