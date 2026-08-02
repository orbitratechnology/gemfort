import PagerView from "@expo/ui/community/pager-view";
import { Image } from "expo-image";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type ImagePagerProps = {
  urls: string[];
  /** Aspect ratio for the inline hero (default 1). */
  aspectRatio?: number;
  /**
   * Full-viewport width, square corners — for edge-to-edge product heroes
   * that bleed under the status bar (profile cover style).
   */
  edgeToEdge?: boolean;
  /** Horizontal thumbnail film strip (default true when 2+ photos). */
  filmStrip?: boolean;
  /** Overlay content (e.g. badges) positioned over the main image only. */
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional shared-element wrapper for the first page only. */
  wrapFirstPage?: (node: ReactNode) => ReactNode;
  accessibilityLabel?: string;
};

type PagerRef = {
  setPage?: (index: number) => void;
  setPageWithoutAnimation?: (index: number) => void;
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
  edgeToEdge = false,
  filmStrip = true,
  overlay,
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
  const pagerRef = useRef<PagerRef | null>(null);
  const webScrollRef = useRef<ScrollView>(null);
  const stripScrollRef = useRef<ScrollView>(null);
  const pageWidth = edgeToEdge
    ? windowWidth
    : windowWidth - Spacing.containerMargin * 2;
  const showStrip = filmStrip && photos.length > 1;

  const openViewer = useCallback((at: number) => {
    setViewerIndex(at);
    setViewerOpen(true);
  }, []);

  const goToPage = useCallback(
    (at: number) => {
      if (at < 0 || at >= photos.length) return;
      setIndex(at);
      if (process.env.EXPO_OS === "web") {
        webScrollRef.current?.scrollTo({ x: at * pageWidth, animated: true });
      } else {
        pagerRef.current?.setPage?.(at);
      }
      // Keep selected thumb roughly centered in the strip
      const thumbStride = 64 + 8;
      stripScrollRef.current?.scrollTo({
        x: Math.max(0, at * thumbStride - pageWidth / 2 + thumbStride / 2),
        animated: true,
      });
    },
    [pageWidth, photos.length],
  );

  const heroSurface = edgeToEdge ? styles.heroEdge : styles.hero;

  if (photos.length === 0) {
    return (
      <View
        style={[
          heroSurface,
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

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          heroSurface,
          {
            aspectRatio,
            // Keep image surface dark so any pager sub-pixel gap matches the photo,
            // never a separate “thick black bar” under a light page bg.
            backgroundColor: edgeToEdge ? "#0a0a0a" : colors.surfaceContainerLowest,
          },
          style,
        ]}
        accessibilityLabel={accessibilityLabel}
      >
        {process.env.EXPO_OS === "web" ? (
          <ScrollView
            ref={webScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
            onMomentumScrollEnd={(e) => {
              const w = e.nativeEvent.layoutMeasurement.width || 1;
              setIndex(Math.round(e.nativeEvent.contentOffset.x / w));
            }}
          >
            {photos.map((uri, i) => {
              const image = (
                <Image
                  source={{ uri }}
                  style={styles.image}
                  contentFit="cover"
                  recyclingKey={uri}
                  transition={200}
                />
              );
              const img = (
                <Pressable
                  key={uri}
                  onPress={() => openViewer(i)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                  style={{ width: pageWidth, height: "100%" }}
                >
                  {i === 0 && wrapFirstPage ? wrapFirstPage(image) : image}
                </Pressable>
              );
              return img;
            })}
          </ScrollView>
        ) : (
          <PagerView
            ref={pagerRef as never}
            style={styles.pager}
            initialPage={0}
            onPageSelected={(e) => setIndex(e.nativeEvent.position)}
          >
            {photos.map((uri, i) => {
              const image = (
                <Image
                  source={{ uri }}
                  style={styles.image}
                  contentFit="cover"
                  recyclingKey={uri}
                  transition={200}
                />
              );
              return (
                <View key={uri} style={styles.page} collapsable={false}>
                  <Pressable
                    onPress={() => openViewer(i)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Double tap to view full screen`}
                    style={styles.pagePressable}
                  >
                    {i === 0 && wrapFirstPage ? wrapFirstPage(image) : image}
                  </Pressable>
                </View>
              );
            })}
          </PagerView>
        )}

        {!showStrip && photos.length > 1 ? (
          <View
            style={[styles.dots, edgeToEdge && styles.dotsEdge]}
            pointerEvents="none"
          >
            {photos.map((uri, i) => (
              <View
                key={uri}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {photos.length > 1 ? (
          <View
            style={[
              showStrip || edgeToEdge ? styles.countPillEdge : styles.countPill,
              { backgroundColor: "rgba(0,0,0,0.55)" },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.countText}>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(photos.length).padStart(2, "0")}
            </Text>
          </View>
        ) : null}

        {overlay ? (
          <View style={styles.overlay} pointerEvents="box-none">
            {overlay}
          </View>
        ) : null}
      </View>

      {showStrip ? (
        <ScrollView
          ref={stripScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={[
            styles.stripContent,
            edgeToEdge
              ? styles.stripContentEdge
              : { paddingHorizontal: 0 },
          ]}
          style={[styles.strip, { backgroundColor: colors.background }]}
        >
          {photos.map((uri, i) => {
            const selected = i === index;
            return (
              <Pressable
                key={`thumb-${uri}`}
                onPress={() => goToPage(i)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show photo ${i + 1}`}
                style={[
                  styles.thumb,
                  {
                    borderColor: selected
                      ? colors.primary
                      : colors.outlineVariant,
                    opacity: selected ? 1 : 0.72,
                  },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  recyclingKey={`thumb-${uri}`}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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
                setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / w));
              }}
            >
              {photos.map((uri) => (
                <View key={uri} style={{ width: windowWidth, height: "100%" }}>
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
              onPageSelected={(e) => setViewerIndex(e.nativeEvent.position)}
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
    </View>
  );
}

const THUMB = 64;

const styles = StyleSheet.create({
  root: { width: "100%" },
  hero: {
    width: "100%",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
  },
  heroEdge: {
    width: "100%",
    overflow: "hidden",
  },
  // flex:1 (not absoluteFill) — Android PagerView collapses images with absolute layout.
  pager: { flex: 1, width: "100%", height: "100%" },
  page: { flex: 1, width: "100%", height: "100%" },
  pagePressable: { flex: 1, width: "100%", height: "100%" },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
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
  dotsEdge: {
    bottom: 20,
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
  countPillEdge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  countText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  strip: {
    marginTop: Spacing.stackSm,
    marginBottom: Spacing.stackSm,
  },
  stripContent: {
    gap: 8,
    // Room for 2px selected borders so thumbs aren’t clipped vertically.
    paddingVertical: 4,
    alignItems: "center",
  },
  stripContentEdge: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackSm,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    borderWidth: 2,
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
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
