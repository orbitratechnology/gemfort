import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Accent,
  DetailBand,
  IconBubble,
  StatusChip,
  TotalRow,
} from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { resolveGemSaleStatus } from "@/features/workspace/gem-lifecycle";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { toTripDate } from "@/features/workspace/trip-utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { formatDate } from "@/lib/utils";
import type { TripGem, WorkspaceGem } from "@/types";

type TripGemsSheetProps = {
  visible: boolean;
  onClose: () => void;
  tripGems: TripGem[];
  gemMap: Map<string, WorkspaceGem>;
  canRecordSales?: boolean;
  onOpenGem: (gemId: string) => void;
  onRequestSale?: (tripGem: TripGem) => void;
  onAddGem?: () => void;
  onAddGems?: () => void;
  showAddGem?: boolean;
  showAddGems?: boolean;
};

const text = { includeFontPadding: false } as const;

/** Gem photo, or the type artwork on the stone's own colour when there is none. */
function GemThumb({
  gem,
  selected,
  size = 48,
}: {
  gem: WorkspaceGem | null | undefined;
  selected?: boolean;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const photo = gemPrimaryPhotoUrl(gem);
  const frame = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
  };
  return (
    <View
      style={[
        styles.thumb,
        frame,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: selected ? colors.primary : "transparent",
          borderWidth: selected ? 2 : 0,
        },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.thumbImg}
          contentFit="cover"
          recyclingKey={photo}
        />
      ) : gem ? (
        <GemArtwork gem={gem} artScale={0.86} style={styles.thumbImg} />
      ) : (
        <Icon
          name="diamond"
          size={Math.round(size * 0.4)}
          color={selected ? colors.primary : colors.outline}
        />
      )}
    </View>
  );
}

/** Role / state chip for a gem on a trip. */
function tripGemStatus(tg: TripGem): { label: string; accent: string } {
  if (tg.status === "sold") return { label: "Sold", accent: Accent.emerald };
  if (tg.status === "returned") return { label: "Returned", accent: Accent.slate };
  return tg.role === "purchase"
    ? { label: "Purchase", accent: Accent.blue }
    : { label: "Parcel", accent: Accent.amber };
}

function tripGemTitle(tg: TripGem, gem: WorkspaceGem | undefined): string {
  return gem?.title?.trim() || gem?.sku || tg.gemId.slice(0, 8);
}

/** Whether a trip gem can start a sale from the trip (on-trip, unsold parcel). */
export function canSellTripGem(
  tg: TripGem,
  gem: WorkspaceGem | undefined,
  canRecordSales: boolean | undefined,
): boolean {
  return (
    !!canRecordSales &&
    !!gem &&
    resolveGemSaleStatus(gem) === "unsold" &&
    tg.role === "parcel" &&
    tg.status === "on_trip"
  );
}

/**
 * Full-width gem row for trip bands and sheets: thumb, name, type · weight,
 * price with a role chip, and an optional Sell pill. Lives inside a padded
 * band/sheet, so it carries no horizontal padding of its own.
 */
export function TripGemRow({
  tripGem: tg,
  gem,
  meta,
  onPress,
  onSell,
  isLast,
}: {
  tripGem: TripGem;
  gem: WorkspaceGem | undefined;
  /** Third line (e.g. sale date). */
  meta?: string | null;
  onPress: () => void;
  onSell?: (() => void) | null;
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();
  const title = tripGemTitle(tg, gem);
  const status = tripGemStatus(tg);
  const amount =
    tg.salePrice != null
      ? formatBase(tg.salePrice)
      : tg.purchaseCost != null
        ? formatBase(tg.purchaseCost)
        : "—";
  const subtitle = gem
    ? `${formatGemType(gem.gemType)} · ${gem.currentWeight} ct`
    : status.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        gem
          ? `${gem.title?.trim() || formatGemType(gem.gemType)}, ${gem.currentWeight} carat, ${status.label}`
          : `Gem, ${status.label}`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.outlineVariant,
        },
        pressed && styles.pressed,
      ]}
    >
      <GemThumb gem={gem} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[styles.rowSubtitle, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowTrailing}>
        <Text
          style={[
            styles.rowAmount,
            { color: tg.salePrice != null ? Accent.emerald : colors.onSurface },
          ]}
          numberOfLines={1}
        >
          {amount}
        </Text>
        {onSell ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sell gem"
            onPress={onSell}
            hitSlop={8}
            style={({ pressed }) => [
              styles.sellPill,
              { backgroundColor: Accent.emerald },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="sell" size={14} color="#FFFFFF" />
            <Text style={styles.sellText}>Sell</Text>
          </Pressable>
        ) : (
          <StatusChip label={status.label} accent={status.accent} size="sm" />
        )}
      </View>
    </Pressable>
  );
}

/** Trip gems list sheet — sale requests start from the gem lifecycle flow. */
export function TripGemsSheet({
  visible,
  onClose,
  tripGems,
  gemMap,
  canRecordSales,
  onOpenGem,
  onRequestSale,
  onAddGem,
  onAddGems,
  showAddGem,
  showAddGems,
}: TripGemsSheetProps) {
  const { colors } = useAppTheme();

  function handleClose() {
    onClose();
  }

  const footerActions =
    showAddGem || showAddGems ? (
      <View style={styles.footerRow}>
        {showAddGem && onAddGem ? (
          <Button
            title="Add gem"
            icon="diamond"
            variant={showAddGems ? "secondary" : "primary"}
            onPress={() => {
              handleClose();
              onAddGem();
            }}
            style={showAddGems ? styles.footerHalf : undefined}
          />
        ) : null}
        {showAddGems && onAddGems ? (
          <Button
            title="Add gems"
            icon="inventory-2"
            onPress={() => {
              handleClose();
              onAddGems();
            }}
            style={showAddGem ? styles.footerHalf : undefined}
          />
        ) : null}
      </View>
    ) : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={tripGems.length ? `Gems · ${tripGems.length}` : "Gems"}
      footer={footerActions}
    >
      {tripGems.length === 0 ? (
        <View style={styles.empty}>
          <IconBubble icon="diamond" accent={Accent.violet} size={52} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No gems on this trip
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Link purchases or parcels to track deals here.
          </Text>
        </View>
      ) : (
        <View>
          {tripGems.map((tg, i) => {
            const gem = gemMap.get(tg.gemId);
            const canSell =
              !!onRequestSale && canSellTripGem(tg, gem, canRecordSales);
            return (
              <TripGemRow
                key={tg.id}
                tripGem={tg}
                gem={gem}
                isLast={i === tripGems.length - 1}
                onPress={() => {
                  handleClose();
                  onOpenGem(tg.gemId);
                }}
                onSell={
                  canSell
                    ? () => {
                        handleClose();
                        onRequestSale?.(tg);
                      }
                    : null
                }
              />
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

/** Standalone gem avatar used in trip lists / sale cards. */
export function TripGemAvatar({
  gem,
  selected,
  size = 44,
}: {
  gem: WorkspaceGem | null | undefined;
  selected?: boolean;
  size?: number;
}) {
  return <GemThumb gem={gem} selected={selected} size={size} />;
}

/** Sold parcels band on the trip detail screen — gem rows and revenue total. */
export function TripSoldGemsSection({
  soldGems,
  gemMap,
  onOpenGem,
}: {
  soldGems: TripGem[];
  gemMap: Map<string, WorkspaceGem>;
  onOpenGem: (gemId: string) => void;
}) {
  const { formatBase } = usePreferredMoney();

  if (soldGems.length === 0) return null;

  const totalRevenue = soldGems.reduce((s, tg) => s + (tg.salePrice ?? 0), 0);

  return (
    <DetailBand title="Sold gems">
      <View>
        {soldGems.map((tg, i) => {
          const saleDate = toTripDate(tg.saleDate);
          return (
            <TripGemRow
              key={tg.id}
              tripGem={tg}
              gem={gemMap.get(tg.gemId)}
              meta={saleDate ? `Sold ${formatDate(saleDate)}` : null}
              isLast={i === soldGems.length - 1}
              onPress={() => onOpenGem(tg.gemId)}
            />
          );
        })}
        <TotalRow
          label={`Revenue · ${soldGems.length} sold`}
          value={formatBase(totalRevenue)}
          accent={Accent.emerald}
        />
      </View>
    </DetailBand>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, marginTop: Spacing.xs },
  emptySub: { ...text, ...Typography.bodySmall, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.7 },
  thumb: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  thumbImg: { width: "100%", height: "100%" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  rowSubtitle: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  rowMeta: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  rowTrailing: { alignItems: "flex-end", gap: 6, maxWidth: "45%" },
  rowAmount: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  sellPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  sellText: { ...text, color: "#FFFFFF", fontFamily: FontFamily.semibold, fontSize: 12 },

  footerRow: { flexDirection: "row", gap: Spacing.sm },
  footerHalf: { flex: 1 },
});
