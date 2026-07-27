import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import type { TripGem, WorkspaceGem } from "@/types";

type TripGemsSheetProps = {
  visible: boolean;
  onClose: () => void;
  tripGems: TripGem[];
  gemMap: Map<string, WorkspaceGem>;
  canRecordSales?: boolean;
  saleTargetId?: string | null;
  onOpenGem: (gemId: string) => void;
  onRecordSale?: (tripGem: TripGem) => void;
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
          color={
            selected ? colors.primary : colors.outlineVariant
          }
        />
      )}
    </View>
  );
}

/** Trip gems list sheet — always shows primary photo when available. */
export function TripGemsSheet({
  visible,
  onClose,
  tripGems,
  gemMap,
  canRecordSales,
  saleTargetId,
  onOpenGem,
  onRecordSale,
  onAddGem,
  onAddGems,
  showAddGem,
  showAddGems,
}: TripGemsSheetProps) {
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();

  const footerActions =
    showAddGem || showAddGems ? (
      <View style={styles.footerRow}>
        {showAddGem && onAddGem ? (
          <Button
            title="Add gem"
            icon="diamond"
            variant={showAddGems ? "secondary" : "primary"}
            onPress={() => {
              onClose();
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
              onClose();
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
      onClose={onClose}
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
            const selected = saleTargetId === tg.id;
            const showSale =
              canRecordSales &&
              tg.role === "parcel" &&
              tg.status === "on_trip" &&
              !selected;

            return (
              <View key={tg.id} style={styles.gemWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    gem
                      ? `${gem.title?.trim() || formatGemType(gem.gemType)}, ${gem.currentWeight} carat`
                      : "Gem"
                  }
                  onPress={() => {
                    onClose();
                    onOpenGem(tg.gemId);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: selected
                        ? colors.primaryContainer
                        : colors.surfaceContainerLow,
                      borderColor: selected
                        ? colors.primary
                        : colors.outlineVariant,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <GemThumb gem={gem} selected={selected} />
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
                  <Text
                    style={[
                      styles.rowAmt,
                      {
                        color: selected
                          ? colors.onPrimaryContainer
                          : colors.primary,
                      },
                    ]}
                  >
                    {tg.salePrice != null
                      ? formatBase(tg.salePrice)
                      : tg.purchaseCost != null
                        ? formatBase(tg.purchaseCost)
                        : "—"}
                  </Text>
                </Pressable>
                {showSale && onRecordSale ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onRecordSale(tg);
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
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

export function TripGemsButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Gems, ${count}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: colors.secondaryContainer },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Icon name="diamond" size={20} color={colors.onSecondaryContainer} />
      <Text
        style={[styles.triggerLabel, { color: colors.onSecondaryContainer }]}
      >
        Gems
      </Text>
      {count > 0 ? (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text
            style={[styles.countText, { color: colors.onSecondaryContainer }]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
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

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: { ...Typography.labelMd, fontWeight: "700" },
  emptySub: { ...Typography.bodySmall, textAlign: "center" },
  list: { gap: Spacing.sm },
  gemWrap: { gap: Spacing.xs },
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
    alignSelf: "flex-end",
    minHeight: 36,
  },
  saleBtnText: { ...Typography.labelMd, fontWeight: "600" },
  footerRow: { flexDirection: "row", gap: Spacing.sm },
  footerHalf: { flex: 1 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    minHeight: 44,
  },
  triggerLabel: { ...Typography.labelMd, fontWeight: "600" },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    minWidth: 22,
    alignItems: "center",
  },
  countText: { ...Typography.labelMd, fontSize: 11, fontWeight: "700" },
});
