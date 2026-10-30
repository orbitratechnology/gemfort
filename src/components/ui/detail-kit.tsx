/**
 * Detail-screen design kit — the shared building blocks behind GemFort's
 * immersive detail screens (gems, AP, services, cheques, bills, trips,
 * payments). Full-width bands instead of inset cards, a title band that can
 * overlap a hero, colour-coded status tiles, label/value rows, and a header
 * that turns solid once the hero scrolls away.
 */
import { useCallback, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Semantic accents. Use the same hue for the same meaning on every screen:
 * violet = work / stage, amber = away / pending / due, blue = listed / info,
 * emerald = done / received / gain, rose = overdue / bounced / loss,
 * slate = idle / closed.
 */
export const Accent = {
  violet: "#7C3AED",
  amber: "#D97706",
  blue: "#2563EB",
  emerald: "#059669",
  rose: "#DC2626",
  slate: "#64748B",
  teal: "#0D9488",
} as const;

const text = { includeFontPadding: false } as const;

// ─── Header ──────────────────────────────────────────────────────────────

/**
 * Tracks whether a hero has scrolled out from under the floating header.
 * Spread `scrollProps` onto the ScrollView.
 */
export function useCollapsingHeader(heroHeight: number) {
  const insets = useSafeAreaInsets();
  const [solid, setSolid] = useState(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > heroHeight - insets.top - 64;
      setSolid((prev) => (prev === next ? prev : next));
    },
    [heroHeight, insets.top],
  );
  return { solid, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/**
 * Absolute header for screens with a hero: floating translucent chips over
 * the hero, then a solid titled bar once `solid` flips.
 */
export function DetailHeader({
  title,
  solid,
  actions = [],
  closeIcon,
}: {
  title: string;
  solid: boolean;
  actions?: HeaderAction[];
  closeIcon?: boolean;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const iconColor = solid ? colors.onSurface : "#FFFFFF";
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.header,
        { paddingTop: insets.top },
        solid && {
          backgroundColor: colors.surfaceContainerLowest,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <StackHeader
        title={solid ? title : ""}
        tintColor={solid ? undefined : "#FFFFFF"}
        closeIcon={closeIcon}
        right={
          actions.length ? (
            <View style={styles.headerActions}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={[styles.headerBtn, !solid && styles.headerChip]}
                >
                  <Icon name={a.icon} size={20} color={iconColor} />
                </Pressable>
              ))}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

/**
 * Colour-washed hero for records without a photo (cheques, bills, services,
 * trips): a large icon on soft halos of the record's accent. Pass `children`
 * to place custom content (e.g. a cheque preview) instead of the icon.
 */
export function TintHero({
  accent,
  icon,
  height,
  children,
}: {
  accent: string;
  icon?: IconName;
  height: number;
  children?: ReactNode;
}) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.hero,
        {
          height,
          paddingTop: insets.top + 24,
          backgroundColor: `${accent}${isDark ? "26" : "14"}`,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.halo, styles.haloOuter, { backgroundColor: `${accent}${isDark ? "1F" : "12"}` }]}
      />
      <View
        pointerEvents="none"
        style={[styles.halo, styles.haloInner, { backgroundColor: `${accent}${isDark ? "2E" : "1C"}` }]}
      />
      {children ??
        (icon ? (
          <View style={[styles.heroIcon, { backgroundColor: accent }]}>
            <Icon name={icon} size={44} color="#FFFFFF" />
          </View>
        ) : null)}
    </View>
  );
}

// ─── Title band ──────────────────────────────────────────────────────────

/**
 * Top band of a detail screen: chips, large title, subtitle, then any
 * children (KeyStats, Callout). `overlapHero` pulls it up over the hero with
 * rounded top corners.
 */
export function TitleBand({
  chips,
  title,
  subtitle,
  subtitleDot,
  overlapHero,
  children,
}: {
  chips?: ReactNode;
  title: string;
  subtitle?: string | null;
  /** Small colour dot before the subtitle (e.g. a gem's hue). */
  subtitleDot?: string | null;
  overlapHero?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.titleBand,
        overlapHero && styles.titleBandOverlap,
        { backgroundColor: colors.surfaceContainerLowest },
      ]}
    >
      {chips ? <View style={styles.chipRow}>{chips}</View> : null}
      <Text style={[styles.title, { color: colors.onSurface }]} selectable={false}>
        {title}
      </Text>
      {subtitle ? (
        <View style={styles.subtitleRow}>
          {subtitleDot ? (
            <View style={[styles.subtitleDot, { backgroundColor: subtitleDot }]} />
          ) : null}
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Tinted status chip with a dot: `Rough · On AP`, `Overdue`, `Paid`. */
export function StatusChip({
  label,
  accent,
  size = "md",
}: {
  label: string;
  accent: string;
  size?: "sm" | "md";
}) {
  const small = size === "sm";
  return (
    <View
      style={[
        styles.statusChip,
        small && styles.statusChipSm,
        { backgroundColor: `${accent}1A` },
      ]}
    >
      <View style={[styles.statusChipDot, small && styles.statusChipDotSm, { backgroundColor: accent }]} />
      <Text
        style={[styles.statusChipText, small && styles.statusChipTextSm, { color: accent }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export type KeyStatItem = {
  label: string;
  value: string;
  sub?: string | null;
  color?: string;
};

/** 2–3 column strip of headline numbers under the title. */
export function KeyStats({ items }: { items: KeyStatItem[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.keyStats, { borderColor: colors.outlineVariant }]}>
      {items.map((item, i) => (
        <View key={item.label} style={styles.keyStatCell}>
          {i > 0 ? (
            <View style={[styles.keyStatDivider, { backgroundColor: colors.outlineVariant }]} />
          ) : null}
          <View style={styles.keyStat}>
            <Text style={[styles.keyStatLabel, { color: colors.onSurfaceVariant }]}>{item.label}</Text>
            <Text
              style={[styles.keyStatValue, { color: item.color ?? colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              selectable={false}
            >
              {item.value}
            </Text>
            {item.sub ? (
              <Text style={[styles.keyStatSub, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sub}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Tinted highlight row: profit, balance due, days to maturity… */
export function Callout({
  icon,
  accent,
  label,
  value,
  pill,
  style,
}: {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  pill?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.callout, { backgroundColor: `${accent}14` }, style]}>
      <IconBubble icon={icon} accent={accent} />
      <View style={styles.calloutCopy}>
        <Text style={[styles.calloutLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.calloutValue, { color: accent }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {pill ? (
        <View style={[styles.pill, { backgroundColor: accent }]}>
          <Text style={styles.pillText}>{pill}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────

/** Full-width section band with an optional title and trailing action. */
export function DetailBand({
  title,
  trailing,
  children,
  style,
}: {
  title?: string;
  trailing?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.band, { backgroundColor: colors.surfaceContainerLowest }, style]}>
      {title ? (
        <View style={styles.bandHeader}>
          <Text style={[styles.bandTitle, { color: colors.onSurface }]} accessibilityRole="header">
            {title}
          </Text>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** "See all 12 ›" style trailing link for a band header. */
export function BandLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.bandLink}
    >
      <Text style={[styles.bandLinkText, { color: colors.primary }]}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.primary} />
    </Pressable>
  );
}

/** Round tinted icon used by rows, tiles and callouts. */
export function IconBubble({
  icon,
  accent,
  size = 36,
}: {
  icon: IconName;
  accent: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${accent}1F`,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={accent} />
    </View>
  );
}

export type DetailRowProps = {
  icon?: IconName;
  accent?: string;
  /** Custom leading node (avatar, swatch, flag) instead of an icon bubble. */
  leading?: ReactNode;
  label: string;
  value: ReactNode;
  /** Second line under the label. */
  hint?: string | null;
  onPress?: () => void;
  isLast?: boolean;
};

/** Label on the left, value on the right; tappable rows get a chevron. */
export function DetailRow({ icon, accent, leading, label, value, hint, onPress, isLast }: DetailRowProps) {
  const { colors } = useAppTheme();
  const tone = accent ?? colors.onSurfaceVariant;
  const body = (
    <>
      {leading ?? (icon ? <IconBubble icon={icon} accent={tone} size={34} /> : null)}
      <View style={styles.rowLabelCol}>
        <Text style={[styles.rowLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: colors.textMuted }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[styles.rowValue, { color: colors.onSurface }]} numberOfLines={2} selectable={false}>
          {value}
        </Text>
      ) : (
        <View style={styles.rowValueWrap}>{value}</View>
      )}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.outline} /> : null}
    </>
  );
  const rowStyle = [
    styles.row,
    !isLast && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

/** Renders rows from data, marking the last one so it drops its divider. */
export function DetailRows({ rows }: { rows: ({ key: string } & DetailRowProps)[] }) {
  return (
    <View>
      {rows.map(({ key, ...row }, i) => (
        <DetailRow key={key} {...row} isLast={i === rows.length - 1} />
      ))}
    </View>
  );
}

export type StatusTileItem = {
  icon: IconName;
  label: string;
  value: string;
  accent: string;
};

/** Colour-coded 2-up grid of status facts (state, location, sale…). */
export function StatusGrid({ tiles }: { tiles: StatusTileItem[] }) {
  const { colors } = useAppTheme();
  const rows: StatusTileItem[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View
      style={styles.statusGrid}
      accessible
      accessibilityLabel={tiles.map((t) => `${t.label} ${t.value}`).join(", ")}
    >
      {rows.map((row, r) => (
        <View key={r} style={styles.statusRow}>
          {row.map((t) => (
            <View key={t.label} style={[styles.statusTile, { backgroundColor: `${t.accent}12` }]}>
              <IconBubble icon={t.icon} accent={t.accent} />
              <View style={styles.statusTileCopy}>
                <Text style={[styles.statusTileLabel, { color: colors.onSurfaceVariant }]}>{t.label}</Text>
                <Text style={[styles.statusTileValue, { color: colors.onSurface }]} numberOfLines={1}>
                  {t.value}
                </Text>
              </View>
            </View>
          ))}
          {row.length === 1 ? <View style={styles.statusTileSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Emphasised total line at the end of a money list. */
export function TotalRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.totalRow,
        { backgroundColor: accent ? `${accent}14` : colors.surfaceContainerLow },
      ]}
    >
      <Text style={[styles.totalLabel, { color: colors.onSurface }]}>{label}</Text>
      <Text style={[styles.totalValue, { color: accent ?? colors.onSurface }]}>{value}</Text>
    </View>
  );
}

// ─── Lists ───────────────────────────────────────────────────────────────

/**
 * Full-width list row for record lists (AP, services, cheques, bills, trips,
 * payables): leading visual, title + subtitle, trailing amount + status.
 */
export function ListItem({
  leading,
  title,
  subtitle,
  meta,
  amount,
  amountColor,
  status,
  onPress,
  isLast,
  right,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  amount?: string | null;
  amountColor?: string;
  status?: { label: string; accent: string } | null;
  onPress?: () => void;
  isLast?: boolean;
  /** Replaces the amount/status column (e.g. action buttons). */
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [
        styles.listItem,
        { backgroundColor: colors.surfaceContainerLowest },
        pressed && { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      {leading}
      <View
        style={[
          styles.listBody,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.listCopy}>
          <Text style={[styles.listTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={[styles.listMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {right ?? (
          <View style={styles.listTrailing}>
            {amount ? (
              <Text style={[styles.listAmount, { color: amountColor ?? colors.onSurface }]} numberOfLines={1}>
                {amount}
              </Text>
            ) : null}
            {status ? <StatusChip label={status.label} accent={status.accent} size="sm" /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Header above a group of `ListItem`s: title, optional accent dot, count and
 * a right-aligned total or hint. Full width, page background behind it.
 */
export function ListSectionHeader({
  title,
  count,
  accent,
  trailing,
  trailingColor,
  hint,
}: {
  title: string;
  count?: number;
  accent?: string;
  /** Right-aligned text, e.g. the group's total. */
  trailing?: string | null;
  /** Colour for `trailing` (e.g. emerald for a positive net). */
  trailingColor?: string;
  /** Second line under the title. */
  hint?: string | null;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.listSection}>
      <View style={styles.listSectionRow}>
        {accent ? <View style={[styles.listSectionDot, { backgroundColor: accent }]} /> : null}
        <Text style={[styles.listSectionTitle, { color: colors.onSurface }]} accessibilityRole="header">
          {title}
        </Text>
        {count != null ? (
          <Text style={[styles.listSectionCount, { color: colors.textMuted }]}>{count}</Text>
        ) : null}
        <View style={styles.listSectionSpacer} />
        {trailing ? (
          <Text
            style={[styles.listSectionTrailing, { color: trailingColor ?? colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {trailing}
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text style={[styles.listSectionHint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

export const detailStyles = StyleSheet.create({
  /** ScrollView content container for band-based screens. */
  scrollContent: { paddingBottom: 48 },
  /** Sticky bottom action bar (pair with Button style={{ flex: 1 }}). */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const styles = StyleSheet.create({
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  headerChip: { borderRadius: 20, backgroundColor: "rgba(0, 0, 0, 0.35)" },

  hero: { width: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  halo: { position: "absolute", aspectRatio: 1, borderRadius: 9999 },
  haloOuter: { width: "96%", maxWidth: 520 },
  haloInner: { width: "64%", maxWidth: 360 },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },

  titleBand: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: 6,
  },
  titleBandOverlap: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: "continuous",
  },
  chipRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.sm, marginBottom: 6 },
  title: { ...text, fontFamily: FontFamily.semibold, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subtitleDot: { width: 10, height: 10, borderRadius: 5 },
  subtitle: { ...text, ...Typography.bodyMd, fontSize: 15, lineHeight: 22, flexShrink: 1 },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  statusChipSm: { height: 22, paddingHorizontal: 8, gap: 5 },
  statusChipDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipDotSm: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { ...text, fontFamily: FontFamily.semibold, fontSize: 12, textTransform: "capitalize" },
  statusChipTextSm: { fontSize: 11 },

  keyStats: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  keyStatCell: { flex: 1, minWidth: 0, flexDirection: "row" },
  keyStat: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 4 },
  keyStatDivider: { width: StyleSheet.hairlineWidth, marginRight: 8 },
  keyStatLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase" },
  keyStatValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 24, fontVariant: ["tabular-nums"] },
  keyStatSub: { ...text, fontFamily: FontFamily.regular, fontSize: 11, lineHeight: 15 },

  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: Spacing.md,
    padding: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  calloutCopy: { flex: 1, minWidth: 0 },
  calloutLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 12 },
  calloutValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 24, fontVariant: ["tabular-nums"] },
  pill: { paddingHorizontal: 10, height: 26, borderRadius: Radius.full, justifyContent: "center" },
  pillText: { ...text, color: "#FFFFFF", fontFamily: FontFamily.semibold, fontSize: 12 },

  band: {
    marginTop: 8,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  bandHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  bandLink: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  bandLinkText: { ...text, fontFamily: FontFamily.semibold, fontSize: 13 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  pressed: { opacity: 0.7 },
  rowLabelCol: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { ...text, fontFamily: FontFamily.regular, fontSize: 14 },
  rowHint: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  rowValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
    flexShrink: 1,
    maxWidth: "60%",
    fontVariant: ["tabular-nums"],
  },
  rowValueWrap: { flexShrink: 1, maxWidth: "60%", alignItems: "flex-end" },

  statusGrid: { gap: 10 },
  statusRow: { flexDirection: "row", gap: 10 },
  statusTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  statusTileSpacer: { flex: 1 },
  statusTileCopy: { flex: 1, minWidth: 0 },
  statusTileLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 11, lineHeight: 15 },
  statusTileValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20 },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  totalLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 15 },
  totalValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 17, fontVariant: ["tabular-nums"] },

  listSection: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  listSectionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  listSectionDot: { width: 8, height: 8, borderRadius: 4 },
  listSectionTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  listSectionCount: { ...text, fontFamily: FontFamily.medium, fontSize: 14 },
  listSectionSpacer: { flex: 1 },
  listSectionTrailing: { ...text, fontFamily: FontFamily.semibold, fontSize: 14, fontVariant: ["tabular-nums"] },
  listSectionHint: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: Spacing.containerMargin },
  listBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
    paddingRight: Spacing.containerMargin,
  },
  listCopy: { flex: 1, minWidth: 0, gap: 2 },
  listTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  listSubtitle: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  listMeta: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  listTrailing: { alignItems: "flex-end", gap: 6, maxWidth: "45%" },
  listAmount: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, fontVariant: ["tabular-nums"] },
});
