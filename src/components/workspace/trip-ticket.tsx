import { differenceInCalendarDays, format } from "date-fns";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { CountryFlag } from "@/components/ui/country-flag";
import { Accent, StatusChip } from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { routeProgress } from "@/components/workspace/trip-hero";
import { TRIP_STATUS_ACCENT } from "@/components/workspace/trip-status-tabs";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { resolveCountryCode } from "@/constants/gem-options";
import { TRIP_STATUS_LABELS, TRIP_TYPES } from "@/constants/trip-options";
import {
  toTripDate,
  tripBudgetBase,
  tripDurationDays,
} from "@/features/workspace/trip-utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import type { Trip } from "@/types";

/** Notch diameter for the perforated tear line between ticket and stub. */
const NOTCH = 20;

type StubCell = { label: string; value: string; color?: string };

/**
 * Trip drawn as a boarding pass: destination with its flag and status, the
 * depart → return route with the plane placed by trip progress, a perforated
 * tear line, then a stub of spend, gems and budget. `notchColor` must match
 * the surface behind the card so the notches read as cut-outs.
 */
export function TripTicket({
  trip,
  pressed,
  notchColor,
}: {
  trip: Trip;
  pressed?: boolean;
  notchColor?: string;
}) {
  const { colors, isDark } = useAppTheme();
  const { formatBase } = usePreferredMoney();

  const city = trip.destinationCity?.trim() || null;
  const country = trip.destinationCountry?.trim() || null;
  const hasFlag = !!resolveCountryCode(country);
  const typeLabel = TRIP_TYPES.find((t) => t.id === trip.tripType)?.label ?? "Trip";
  const start = toTripDate(trip.startDate);
  const end = toTripDate(trip.actualEndDate ?? trip.expectedEndDate);
  const days = tripDurationDays(trip);
  const done = trip.status === "completed";
  const progress = routeProgress(trip.status, start, end);
  const dayOf =
    trip.status === "ongoing" && start
      ? Math.min(days, Math.max(1, differenceInCalendarDays(new Date(), start) + 1))
      : null;
  const durationLabel = dayOf
    ? `Day ${dayOf} of ${days}`
    : `${days} day${days === 1 ? "" : "s"}`;
  const pct = `${Math.round(progress * 100)}%` as const;
  const cutout = notchColor ?? colors.background;

  const { totalExpenses, totalGemsPurchased, totalGemsSold, totalRevenue, netResult } =
    trip.summary;
  const budgetBase = tripBudgetBase(trip);
  const budgetLeft = budgetBase - totalExpenses;
  const gemsValue =
    [
      totalGemsPurchased > 0 ? `${totalGemsPurchased} bought` : null,
      totalGemsSold > 0 ? `${totalGemsSold} sold` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "None yet";
  const lastCell: StubCell =
    done && totalRevenue > 0
      ? {
          label: "Net",
          value: formatBase(netResult),
          color: netResult < 0 ? Accent.rose : undefined,
        }
      : budgetBase > 0
        ? {
            label: budgetLeft < 0 ? "Over budget" : "Budget left",
            value: formatBase(Math.abs(budgetLeft)),
            color: budgetLeft < 0 ? Accent.rose : undefined,
          }
        : { label: "Budget", value: "Not set", color: colors.textMuted };
  const stub: StubCell[] = [
    { label: "Expenses", value: totalExpenses > 0 ? formatBase(totalExpenses) : "—" },
    { label: "Gems", value: gemsValue },
    lastCell,
  ];

  return (
    <View
      style={[
        styles.ticket,
        {
          backgroundColor: colors.surfaceContainerLowest,
          boxShadow: isDark
            ? "0 1px 2px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.28)"
            : "0 1px 2px rgba(15,23,42,0.06), 0 8px 20px rgba(15,23,42,0.07)",
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.main}>
        <View style={styles.headerRow}>
          <View style={[styles.flagTile, { backgroundColor: colors.surfaceContainerLow }]}>
            {hasFlag ? (
              <CountryFlag country={country} width={30} height={20} style={styles.flag} />
            ) : (
              <Icon name="public" size={20} color={colors.onSurfaceVariant} />
            )}
          </View>
          <View style={styles.titleCopy}>
            <Text style={[styles.place, { color: colors.onSurface }]} numberOfLines={1}>
              {city ?? country ?? trip.tripName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {[trip.tripName, typeLabel].join(" · ")}
            </Text>
          </View>
          <StatusChip
            label={TRIP_STATUS_LABELS[trip.status]}
            accent={TRIP_STATUS_ACCENT[trip.status]}
            size="sm"
          />
        </View>

        <View style={styles.route}>
          <View style={styles.end}>
            <Text style={[styles.endLabel, { color: colors.textMuted }]}>Depart</Text>
            <Text style={[styles.endDate, { color: colors.onSurface }]} numberOfLines={1}>
              {start ? format(start, "d MMM") : "—"}
            </Text>
            <Text style={[styles.endSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {start ? format(start, "EEE") : " "}
            </Text>
          </View>

          <View style={styles.path}>
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
              <View style={[styles.flown, { width: pct, backgroundColor: colors.onSurface }]} />
              <View style={[styles.node, styles.nodeStart, { backgroundColor: colors.onSurface }]} />
              <View
                style={[
                  styles.node,
                  styles.nodeEnd,
                  done
                    ? { backgroundColor: colors.onSurface }
                    : {
                        borderWidth: 1.5,
                        borderColor: colors.outline,
                        backgroundColor: colors.surfaceContainerLowest,
                      },
                ]}
              />
              <View
                style={[
                  styles.planeBubble,
                  { left: pct, backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <View style={styles.planeGlyph}>
                  <Icon name="flight" size={18} color={colors.onSurface} />
                </View>
              </View>
            </View>
            <Text style={[styles.duration, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {durationLabel}
            </Text>
          </View>

          <View style={[styles.end, styles.endRight]}>
            <Text style={[styles.endLabel, { color: colors.textMuted }]}>
              {done ? "Returned" : "Return"}
            </Text>
            <Text style={[styles.endDate, { color: colors.onSurface }]} numberOfLines={1}>
              {end ? format(end, "d MMM") : "—"}
            </Text>
            <Text style={[styles.endSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {end ? format(end, "EEE") : " "}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tear} pointerEvents="none">
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: cutout }]} />
        <View style={[styles.perforation, { borderColor: colors.outlineVariant }]} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: cutout }]} />
      </View>

      <View style={styles.stub}>
        {stub.map((cell) => (
          <View key={cell.label} style={styles.stubCell}>
            <Text style={[styles.stubLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {cell.label}
            </Text>
            <Text
              style={[styles.stubValue, { color: cell.color ?? colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  ticket: {
    borderRadius: Radius.xl + 4,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  main: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flagTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { borderRadius: 3 },
  titleCopy: { flex: 1, minWidth: 0, gap: 1 },
  place: { ...text, fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subtitle: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },

  route: { flexDirection: "row", alignItems: "center", gap: 10 },
  end: { minWidth: 58, gap: 1 },
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
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  endSub: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  path: { flex: 1, minWidth: 0, gap: 8, paddingTop: 12 },
  track: { height: 2, justifyContent: "center" },
  flown: { position: "absolute", left: 0, height: 1.5, borderRadius: 1 },
  node: { position: "absolute", width: 7, height: 7, borderRadius: 4, top: -2.5 },
  nodeStart: { left: -3 },
  nodeEnd: { right: -3 },
  planeBubble: {
    position: "absolute",
    top: -12,
    width: 26,
    height: 26,
    marginLeft: -13,
    borderRadius: 13,
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

  tear: { height: NOTCH, flexDirection: "row", alignItems: "center" },
  notch: { width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  notchLeft: { marginLeft: -NOTCH / 2 },
  notchRight: { marginRight: -NOTCH / 2 },
  perforation: {
    flex: 1,
    marginHorizontal: 6,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
  },

  stub: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  stubCell: { flex: 1, minWidth: 0, gap: 2 },
  stubLabel: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stubValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ["tabular-nums"],
  },
});
