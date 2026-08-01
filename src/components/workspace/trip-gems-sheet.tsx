import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
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
  onConfirmSale?: (tripGem: TripGem, price: number) => Promise<void>;
  onAddGem?: () => void;
  onAddGems?: () => void;
  showAddGem?: boolean;
  showAddGems?: boolean;
};

function GemThumb({
  gem,
  selected,
  size = 44,
}: {
  gem: WorkspaceGem | null | undefined;
  selected?: boolean;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const photo = gemPrimaryPhotoUrl(gem);
  return (
    <View
      style={[
        styles.thumb,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
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
      ) : (
        <Icon
          name="diamond"
          size={Math.round(size * 0.4)}
          color={selected ? colors.primary : colors.outlineVariant}
        />
      )}
    </View>
  );
}

/** Trip gems list sheet — Record Sale available on every eligible parcel. */
export function TripGemsSheet({
  visible,
  onClose,
  tripGems,
  gemMap,
  canRecordSales,
  onOpenGem,
  onConfirmSale,
  onAddGem,
  onAddGems,
  showAddGem,
  showAddGems,
}: TripGemsSheetProps) {
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();
  const [saleGemId, setSaleGemId] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  function handleClose() {
    setSaleGemId(null);
    setSalePrice("");
    onClose();
  }

  async function confirmSale(tg: TripGem) {
    if (!onConfirmSale) return;
    const price = parseFloat(salePrice);
    if (!price || price <= 0) return;
    setSavingSale(true);
    try {
      await onConfirmSale(tg, price);
      setSaleGemId(null);
      setSalePrice("");
    } finally {
      setSavingSale(false);
    }
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
      title="Gems"
      footer={footerActions}
    >
      {tripGems.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="diamond" size={28} color={colors.outlineVariant} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No gems on this trip
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Link purchases or parcels to track deals here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tripGems.map((tg) => {
            const gem = gemMap.get(tg.gemId);
            const canSell =
              !!canRecordSales &&
              !!onConfirmSale &&
              tg.role === "parcel" &&
              tg.status === "on_trip";
            const selling = saleGemId === tg.id;

            return (
              <View key={tg.id} style={styles.gemWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    gem
                      ? `${gem.title?.trim() || formatGemType(gem.gemType)}, ${gem.currentWeight} carat`
                      : "Gem"
                  }
                  onPress={() => {
                    handleClose();
                    onOpenGem(tg.gemId);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <GemThumb gem={gem} />
                  <View style={styles.rowBody}>
                    <Text
                      style={[styles.rowTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {gem?.title?.trim() ||
                        gem?.sku ||
                        tg.gemId.slice(0, 8)}{" "}
                      · {tg.role === "purchase" ? "Purchase" : "Parcel"}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {gem
                        ? `${formatGemType(gem.gemType)} · ${gem.currentWeight}ct`
                        : tg.status}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmt, { color: colors.primary }]}>
                    {tg.salePrice != null
                      ? formatBase(tg.salePrice)
                      : tg.purchaseCost != null
                        ? formatBase(tg.purchaseCost)
                        : "—"}
                  </Text>
                </Pressable>

                {canSell ? (
                  selling ? (
                    <View
                      style={[
                        styles.salePanel,
                        {
                          backgroundColor: colors.primaryContainer,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <MaskedInput
                        label="Sale price (LKR)"
                        mode="currency"
                        value={salePrice}
                        onChangeText={setSalePrice}
                        placeholder="0"
                        leftIcon="payments"
                      />
                      <View style={styles.saleActions}>
                        <Button
                          title="Cancel"
                          variant="secondary"
                          onPress={() => {
                            setSaleGemId(null);
                            setSalePrice("");
                          }}
                          style={styles.footerHalf}
                          disabled={savingSale}
                        />
                        <Button
                          title="Confirm"
                          icon="check-circle"
                          loading={savingSale}
                          onPress={() => confirmSale(tg)}
                          style={styles.footerHalf}
                        />
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Record sale"
                      onPress={() => {
                        setSaleGemId(tg.id);
                        setSalePrice("");
                      }}
                      style={({ pressed }) => [
                        styles.saleBtn,
                        { backgroundColor: colors.primaryContainer },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Icon
                        name="sell"
                        size={16}
                        color={colors.onPrimaryContainer}
                      />
                      <Text
                        style={[
                          styles.saleBtnText,
                          { color: colors.onPrimaryContainer },
                        ]}
                      >
                        Record sale
                      </Text>
                    </Pressable>
                  )
                ) : null}
              </View>
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

/** Sold parcels on the trip detail screen — count, revenue, gem cards. */
export function TripSoldGemsSection({
  soldGems,
  gemMap,
  onOpenGem,
}: {
  soldGems: TripGem[];
  gemMap: Map<string, WorkspaceGem>;
  onOpenGem: (gemId: string) => void;
}) {
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();

  if (soldGems.length === 0) return null;

  const totalRevenue = soldGems.reduce((s, tg) => s + (tg.salePrice ?? 0), 0);

  return (
    <View style={styles.soldSection}>
      <Text style={[styles.soldSectionTitle, { color: colors.onSurface }]}>
        Sold gems
      </Text>

      <View style={styles.soldStats}>
        <View
          style={[
            styles.soldStatCard,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text style={[styles.soldStatLabel, { color: colors.textMuted }]}>
            Sold
          </Text>
          <Text
            selectable
            style={[styles.soldStatValue, { color: colors.onSurface }]}
          >
            {soldGems.length}
          </Text>
        </View>
        <View
          style={[
            styles.soldStatCard,
            styles.soldStatCardWide,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text style={[styles.soldStatLabel, { color: colors.textMuted }]}>
            Revenue
          </Text>
          <Text
            selectable
            style={[styles.soldStatValue, { color: colors.successEmerald }]}
          >
            {formatBase(totalRevenue)}
          </Text>
        </View>
      </View>

      <View style={styles.soldList}>
        {soldGems.map((tg) => {
          const gem = gemMap.get(tg.gemId);
          const title =
            gem?.title?.trim() || gem?.sku || tg.gemId.slice(0, 8);
          const typeLabel = gem ? formatGemType(gem.gemType) : null;
          const weightLabel = gem ? `${gem.currentWeight} ct` : null;
          const saleDate = toTripDate(tg.saleDate);

          return (
            <Pressable
              key={tg.id}
              accessibilityRole="button"
              accessibilityLabel={`${title}, sold`}
              onPress={() => onOpenGem(tg.gemId)}
              style={({ pressed }) => [
                styles.soldGemCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <GemThumb gem={gem} size={72} />
              <View style={styles.soldGemBody}>
                <Text
                  style={[styles.soldGemTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {(typeLabel || weightLabel) && (
                  <Text
                    style={[styles.soldGemMeta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {[typeLabel, weightLabel].filter(Boolean).join(" · ")}
                  </Text>
                )}
                {gem?.sku ? (
                  <Text
                    style={[styles.soldGemSku, { color: colors.onSurfaceVariant }]}
                    numberOfLines={1}
                  >
                    {gem.sku}
                  </Text>
                ) : null}
                <View style={styles.soldGemFooter}>
                  <Text
                    selectable
                    style={[styles.soldGemPrice, { color: colors.successEmerald }]}
                  >
                    {tg.salePrice != null ? formatBase(tg.salePrice) : "—"}
                  </Text>
                  {saleDate ? (
                    <Text
                      style={[
                        styles.soldGemDate,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {formatDate(saleDate)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Icon name="chevron-right" size={20} color={colors.outline} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: { ...Typography.labelMd, fontWeight: "700" },
  emptySub: { ...Typography.bodySmall, textAlign: "center" },
  list: { gap: Spacing.md },
  gemWrap: { gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  thumb: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  thumbImg: { width: "100%", height: "100%" },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...Typography.labelMd, fontWeight: "600" },
  rowSub: { ...Typography.bodySmall },
  rowAmt: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  saleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    alignSelf: "stretch",
    minHeight: 44,
  },
  saleBtnText: { ...Typography.labelMd, fontWeight: "600" },
  salePanel: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  saleActions: { flexDirection: "row", gap: Spacing.sm },
  footerRow: { flexDirection: "row", gap: Spacing.sm },
  footerHalf: { flex: 1 },

  soldSection: { gap: Spacing.md },
  soldSectionTitle: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
  },
  soldStats: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  soldStatCard: {
    flex: 1,
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  soldStatCardWide: { flex: 1.4 },
  soldStatLabel: {
    ...Typography.labelMd,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  soldStatValue: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  soldList: { gap: Spacing.sm },
  soldGemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  soldGemBody: { flex: 1, gap: 3, minWidth: 0 },
  soldGemTitle: { ...Typography.labelMd, fontWeight: "700", fontSize: 15 },
  soldGemMeta: { ...Typography.bodySmall },
  soldGemSku: { ...Typography.caption },
  soldGemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginTop: 2,
  },
  soldGemPrice: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  soldGemDate: { ...Typography.caption },
});
