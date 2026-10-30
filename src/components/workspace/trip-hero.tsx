import { differenceInCalendarDays, format } from "date-fns";
import { Image } from "expo-image";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Path } from "react-native-svg";

import { CountryFlag } from "@/components/ui/country-flag";
import { Icon } from "@/components/ui/icon";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import { flagUrl, resolveCountryCode } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { TripStatus } from "@/types";

const HERO_INK = "#0A0A0A";
/** Height the title band pulls up over the hero (`TitleBand overlapHero`). */
const TITLE_OVERLAP = 24;

/**
 * Dark trip hero: the destination flag fills the background, desaturated and
 * washed down to ink so it reads as texture rather than colour, with the
 * airliner crossing on a dashed flight path and the destination set large.
 */
export function TripFlagHero({
  country,
  city,
  height,
}: {
  country: string | null | undefined;
  city: string | null | undefined;
  height: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const code = resolveCountryCode(country);
  const countryName = country?.trim() || null;
  const cityName = city?.trim() || null;
  const place = cityName ?? countryName ?? "Trip";
  const caption = cityName && countryName ? countryName : "Destination";

  // trips-icon.png is square; the airliner spans ~5–93% across and ~33–62%
  // down it. Size it so the jet sits top-right under the header.
  const planeSize = Math.min(width * 0.8, 380);
  const planeLeft = width - planeSize * 0.97;
  const planeTop = insets.top + 52 - planeSize * 0.33;
  // Trail starts off-screen bottom-left and tucks under the jet's engines.
  const trailEndX = planeLeft + planeSize * 0.42;
  const trailEndY = planeTop + planeSize * 0.56;
  const trail = `M -12 ${height * 0.86} C ${width * 0.12} ${height * 0.6}, ${trailEndX - width * 0.28} ${trailEndY + 28}, ${trailEndX} ${trailEndY}`;

  return (
    <View
      style={[styles.hero, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={cityName && countryName ? `${cityName}, ${countryName}` : place}
    >
      {code ? (
        <>
          <Image
            source={{ uri: flagUrl(code, 1280) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={240}
            accessibilityIgnoresInvertColors
          />
          {/* Grey layer in saturation blend drains most of the flag's colour. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.desaturate]} />
        </>
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Svg
        pointerEvents="none"
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
      >
        <Path
          d={trail}
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth={1.4}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
      </Svg>

      <Image
        source={require("@/assets/images/trips-icon.png")}
        style={[
          styles.plane,
          { width: planeSize, height: planeSize, left: planeLeft, top: planeTop },
        ]}
        contentFit="contain"
        pointerEvents="none"
        accessibilityIgnoresInvertColors
      />

      <View
        pointerEvents="none"
        style={[styles.copy, { bottom: TITLE_OVERLAP + Spacing.xl }]}
      >
        <View style={styles.captionRow}>
          {code ? (
            <View style={styles.miniFlag}>
              <CountryFlag country={country} width={22} height={15} />
            </View>
          ) : (
            <Icon name="place" size={15} color="rgba(255,255,255,0.72)" />
          )}
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        </View>
        <Text
          style={styles.place}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {place}
        </Text>
      </View>
    </View>
  );
}

/** How far along the route the plane sits for each trip state. */
export function routeProgress(status: TripStatus, start: Date | null, end: Date | null) {
  if (status === "completed") return 1;
  if (status !== "ongoing" || !start || !end) return 0;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0.5;
  const elapsed = (Date.now() - start.getTime()) / span;
  // Keep the plane clear of the end markers while the trip is under way.
  return Math.min(0.92, Math.max(0.08, elapsed));
}

function RouteEnd({
  label,
  date,
  align,
}: {
  label: string;
  date: Date | null;
  align: "left" | "right";
}) {
  const { colors } = useAppTheme();
  const textAlign = align;
  return (
    <View style={[styles.end, align === "right" && styles.endRight]}>
      <Text style={[styles.endLabel, { color: colors.textMuted, textAlign }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.endDate, { color: colors.onSurface, textAlign }]} numberOfLines={1}>
        {date ? format(date, "d MMM") : "—"}
      </Text>
      <Text style={[styles.endSub, { color: colors.onSurfaceVariant, textAlign }]} numberOfLines={1}>
        {date ? format(date, "EEE · yyyy") : " "}
      </Text>
    </View>
  );
}

/**
 * Boarding-pass style route: departure and return dates joined by a dashed
 * flight path, with the plane placed by how far through the trip it is.
 */
export function TripRouteStrip({
  status,
  start,
  end,
  days,
}: {
  status: TripStatus;
  start: Date | null;
  end: Date | null;
  days: number;
}) {
  const { colors } = useAppTheme();
  const progress = routeProgress(status, start, end);
  const done = status === "completed";
  const dayOf =
    status === "ongoing" && start
      ? Math.min(days, Math.max(1, differenceInCalendarDays(new Date(), start) + 1))
      : null;
  const durationLabel = dayOf
    ? `Day ${dayOf} of ${days}`
    : `${days} day${days === 1 ? "" : "s"}`;
  const ink = status === "cancelled" ? colors.textMuted : colors.onSurface;
  const pct = `${Math.round(progress * 100)}%` as const;

  return (
    <View
      style={[styles.strip, { backgroundColor: colors.surfaceContainerLow }]}
      accessible
      accessibilityLabel={[
        start ? `Departs ${format(start, "d MMMM yyyy")}` : null,
        end ? `${done ? "Returned" : "Returns"} ${format(end, "d MMMM yyyy")}` : null,
        durationLabel,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <RouteEnd label={status === "planning" ? "Departs" : "Departed"} date={start} align="left" />

      <View style={styles.route}>
        <View style={styles.track}>
          <Svg height={2} width="100%" style={StyleSheet.absoluteFill}>
            <Line
              x1="0"
              y1="1"
              x2="100%"
              y2="1"
              stroke={colors.outline}
              strokeWidth={1.5}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
          </Svg>
          <View style={[styles.flown, { width: pct, backgroundColor: ink }]} />
          <View style={[styles.node, styles.nodeStart, { backgroundColor: ink }]} />
          <View
            style={[
              styles.node,
              styles.nodeEnd,
              done
                ? { backgroundColor: ink }
                : { borderWidth: 1.5, borderColor: colors.outline, backgroundColor: colors.surfaceContainerLow },
            ]}
          />
          <View
            style={[
              styles.planeBubble,
              { left: pct, backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <View style={styles.planeGlyph}>
              <Icon name="flight" size={20} color={ink} />
            </View>
          </View>
        </View>
        <Text style={[styles.duration, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {durationLabel}
        </Text>
      </View>

      <RouteEnd label={done ? "Returned" : "Returns"} date={end} align="right" />
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  hero: { width: "100%", overflow: "hidden", backgroundColor: HERO_INK },
  desaturate: {
    backgroundColor: "#7A7A7A",
    opacity: 0.72,
    mixBlendMode: "saturation",
  },
  scrim: {
    experimental_backgroundImage:
      "linear-gradient(to bottom, rgba(10,10,10,0.62) 0%, rgba(10,10,10,0.38) 34%, rgba(10,10,10,0.62) 62%, rgba(10,10,10,0.94) 100%)",
  },
  plane: { position: "absolute", transform: [{ rotate: "-7deg" }] },
  copy: {
    position: "absolute",
    left: Spacing.containerMargin,
    right: Spacing.containerMargin,
    gap: 4,
  },
  captionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniFlag: {
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.45)",
  },
  caption: {
    ...text,
    flexShrink: 1,
    fontFamily: FontFamily.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.72)",
  },
  place: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.9,
    color: "#FFFFFF",
  },

  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: Spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  end: { minWidth: 64, gap: 1 },
  endRight: { alignItems: "flex-end" },
  endLabel: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  endDate: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  endSub: { ...text, fontFamily: FontFamily.regular, fontSize: 11, lineHeight: 15 },
  route: { flex: 1, minWidth: 0, gap: 8, paddingTop: 14 },
  track: { height: 2, justifyContent: "center" },
  flown: { position: "absolute", left: 0, height: 1.5, borderRadius: 1 },
  node: { position: "absolute", width: 7, height: 7, borderRadius: 4, top: -2.5 },
  nodeStart: { left: -3 },
  nodeEnd: { right: -3 },
  planeBubble: {
    position: "absolute",
    top: -13,
    width: 28,
    height: 28,
    marginLeft: -14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planeGlyph: { transform: [{ rotate: "90deg" }] },
  duration: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
