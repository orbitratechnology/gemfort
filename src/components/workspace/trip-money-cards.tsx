import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { Icon } from "@/components/ui/icon";
import {
  BrandPalette,
  Radius,
  Spacing,
  Typography,
} from "@/constants/design-tokens";
import { resolveCurrencyCode } from "@/constants/currencies";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";
import { parseAmountInput } from "@/lib/money/mask";

type TripResultsCardProps = {
  expenses: string;
  purchases: string;
  sold: string;
  netResult: string;
  netPositive: boolean;
};

/** Deal activity — expenses, gem counts, and net result. */
export function TripResultsCard({
  expenses,
  purchases,
  sold,
  netResult,
  netPositive,
}: TripResultsCardProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerLowest },
      ]}
    >
      <View style={styles.cardHead}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Icon name="insights" size={18} color={colors.onPrimaryContainer} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
          Results
        </Text>
      </View>

      <View style={styles.statGrid}>
        <MiniStat label="Expenses" value={expenses} colors={colors} />
        <MiniStat label="Purchases" value={purchases} colors={colors} />
        <MiniStat label="Sold" value={sold} colors={colors} />
        <MiniStat
          label="Net"
          value={netResult}
          colors={colors}
          accent={netPositive ? colors.successEmerald : colors.error}
        />
      </View>
    </View>
  );
}

type TripBudgetCardProps = {
  budgetLabel: string;
  usedLabel: string;
  remainingLabel: string;
  remainingNegative: boolean;
  percent: number;
  /** Face amount currently stored on the trip. */
  budgetAmount: number;
  budgetCurrency: string;
  onSaveBudget: (next: {
    budget: number;
    budgetCurrency: string;
  }) => void | Promise<void>;
};

/** Dedicated budget progress card — tap to edit. */
export function TripBudgetCard({
  budgetLabel,
  usedLabel,
  remainingLabel,
  remainingNegative,
  percent,
  budgetAmount,
  budgetCurrency,
  onSaveBudget,
}: TripBudgetCardProps) {
  const { colors } = useAppTheme();
  const over = percent > 90 || remainingNegative;
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<CurrencyAmountValue>({
    amount: budgetAmount > 0 ? String(budgetAmount) : "",
    currency: resolveCurrencyCode(budgetCurrency),
  });
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setDraft({
      amount: budgetAmount > 0 ? String(budgetAmount) : "",
      currency: resolveCurrencyCode(budgetCurrency),
    });
    setEditOpen(true);
  }

  async function handleSave() {
    const parsed = parseAmountInput(draft.amount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      await onSaveBudget({
        budget: parsed,
        budgetCurrency: draft.currency,
      });
      setEditOpen(false);
    } catch {
      // Parent surfaces the error toast.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit trip budget"
        onPress={haptics.wrap("light", openEdit)}
        style={({ pressed }) => [
          styles.card,
          styles.budgetCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.primary + "33",
            borderWidth: 1.5,
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.budgetWash,
            {
              experimental_backgroundImage: `linear-gradient(135deg, ${colors.primaryContainer}AA 0%, transparent 60%)`,
            },
          ]}
        />

        <View style={styles.cardHead}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: colors.primary + "18" },
            ]}
          >
            <Icon name="pie-chart" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Budget
          </Text>
          <Icon name="edit" size={18} color={colors.primary} />
        </View>

        <Text
          selectable
          style={[styles.budgetHero, { color: colors.onSurface }]}
        >
          {budgetLabel}
        </Text>

        <View style={styles.budgetSplit}>
          <View style={styles.budgetCol}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              Used
            </Text>
            <Text
              selectable
              style={[styles.budgetValue, { color: colors.onSurface }]}
            >
              {usedLabel}
            </Text>
          </View>
          <View style={styles.budgetCol}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              Remaining
            </Text>
            <Text
              selectable
              style={[
                styles.budgetValue,
                {
                  color: remainingNegative
                    ? colors.error
                    : colors.successEmerald,
                },
              ]}
            >
              {remainingLabel}
            </Text>
          </View>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressLabels}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              Progress
            </Text>
            <Text
              style={[
                styles.progressPct,
                { color: over ? colors.error : colors.onSurface },
              ]}
            >
              {percent}%
            </Text>
          </View>
          <View
            style={[
              styles.track,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, percent)}%`,
                  backgroundColor: over ? colors.error : colors.primary,
                },
              ]}
            />
          </View>
        </View>

        <Text style={[styles.editHint, { color: colors.textMuted }]}>
          Tap to update budget
        </Text>
      </Pressable>

      <BottomSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Update budget"
        footer={
          <Button
            title="Save budget"
            icon="check"
            loading={saving}
            onPress={handleSave}
          />
        }
      >
        <View style={styles.editBody}>
          <CurrencyAmountField
            label="Trip budget"
            value={draft}
            onChange={setDraft}
            placeholder="0"
          />
        </View>
      </BottomSheet>
    </>
  );
}

type TripWalletCardProps = {
  cashInHand: string;
  startedWith: string;
  spentFromCash: string;
  hasCash: boolean;
};

/** Wallet-style card — current cash in hand, not initial carry. */
export function TripWalletCard({
  cashInHand,
  startedWith,
  spentFromCash,
  hasCash,
}: TripWalletCardProps) {
  const { colors, isDark } = useAppTheme();

  if (!hasCash) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surfaceContainerLowest },
        ]}
      >
        <View style={styles.cardHead}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <Icon
              name="account-balance-wallet"
              size={18}
              color={colors.onSurfaceVariant}
            />
          </View>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Cash wallet
          </Text>
        </View>
        <Text style={[styles.emptyWallet, { color: colors.textMuted }]}>
          No cash carried on this trip.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.walletWrap}>
      <View
        style={[
          styles.walletShadow,
          { backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.14)" },
        ]}
      />
      <View
        style={[
          styles.walletFace,
          {
            backgroundColor: BrandPalette.primary,
            experimental_backgroundImage:
              "linear-gradient(145deg, #2a2a2a 0%, #171717 48%, #0a0a0a 100%)",
          },
        ]}
      >
        <View style={styles.walletTop}>
          <View style={styles.walletBrand}>
            <View style={styles.chip}>
              <View style={styles.chipStripe} />
            </View>
            <Text style={styles.walletLabel}>Cash in hand</Text>
          </View>
          <Icon
            name="account-balance-wallet"
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </View>

        <Text selectable style={styles.walletAmount}>
          {cashInHand}
        </Text>

        <View style={styles.walletFooter}>
          <View style={styles.walletMeta}>
            <Text style={styles.walletMetaLabel}>Started with</Text>
            <Text selectable style={styles.walletMetaValue}>
              {startedWith}
            </Text>
          </View>
          <View style={styles.walletMeta}>
            <Text style={styles.walletMetaLabel}>Spent from cash</Text>
            <Text selectable style={styles.walletMetaValue}>
              {spentFromCash}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Large dual action tiles for Expenses + Gems. */
export function TripQuickActions({
  expenseCount,
  gemCount,
  onExpenses,
  onGems,
}: {
  expenseCount: number;
  gemCount: number;
  onExpenses: () => void;
  onGems: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.quickRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Expenses, ${expenseCount}`}
        onPress={haptics.wrap("light", onExpenses)}
        style={({ pressed }) => [
          styles.quickTile,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View
          style={[
            styles.quickIcon,
            { backgroundColor: colors.onPrimary + "22" },
          ]}
        >
          <Icon name="receipt" size={24} color={colors.onPrimary} />
        </View>
        <View style={styles.quickText}>
          <Text style={[styles.quickTitle, { color: colors.onPrimary }]}>
            Expenses
          </Text>
          <Text
            style={[styles.quickSub, { color: colors.onPrimary + "CC" }]}
          >
            {expenseCount === 0
              ? "Log costs"
              : `${expenseCount} logged`}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.onPrimary + "99"} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Gems, ${gemCount}`}
        onPress={haptics.wrap("light", onGems)}
        style={({ pressed }) => [
          styles.quickTile,
          {
            backgroundColor: colors.secondaryContainer,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View
          style={[
            styles.quickIcon,
            { backgroundColor: colors.onSecondaryContainer + "18" },
          ]}
        >
          <Icon name="diamond" size={24} color={colors.onSecondaryContainer} />
        </View>
        <View style={styles.quickText}>
          <Text
            style={[styles.quickTitle, { color: colors.onSecondaryContainer }]}
          >
            Gems
          </Text>
          <Text
            style={[
              styles.quickSub,
              { color: colors.onSecondaryContainer + "CC" },
            ]}
          >
            {gemCount === 0 ? "Link gems" : `${gemCount} on trip`}
          </Text>
        </View>
        <Icon
          name="chevron-right"
          size={22}
          color={colors.onSecondaryContainer + "99"}
        />
      </Pressable>
    </View>
  );
}

function MiniStat({
  label,
  value,
  colors,
  accent,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  accent?: string;
}) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        selectable
        style={[styles.miniValue, { color: accent ?? colors.onSurface }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: "hidden",
  },
  budgetCard: {
    position: "relative",
  },
  budgetWash: {
    borderRadius: Radius.xl,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
    flex: 1,
  },
  budgetHero: {
    ...Typography.displayLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  editHint: { ...Typography.caption },
  editBody: { gap: Spacing.md, paddingBottom: Spacing.sm },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  miniStat: { width: "47%", gap: 2 },
  metaLabel: {
    ...Typography.labelMd,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  miniValue: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  budgetSplit: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  budgetCol: { flex: 1, gap: 2 },
  budgetValue: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  progressBlock: { gap: Spacing.sm },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressPct: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  emptyWallet: { ...Typography.bodySmall },

  walletWrap: {
    position: "relative",
    minHeight: 148,
  },
  walletShadow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 8,
    height: "88%",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    transform: [{ rotate: "2.5deg" }],
  },
  walletFace: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
    minHeight: 148,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
  },
  walletTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walletBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  chip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255, 214, 120, 0.92)",
    overflow: "hidden",
    justifyContent: "center",
  },
  chipStripe: {
    height: 8,
    backgroundColor: "rgba(180, 120, 40, 0.35)",
  },
  walletLabel: {
    ...Typography.labelMd,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 11,
  },
  walletAmount: {
    ...Typography.headlineMdMobile,
    color: "#FFFFFF",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontSize: 28,
    lineHeight: 34,
  },
  walletFooter: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: "auto",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  walletMeta: { flex: 1, gap: 2 },
  walletMetaLabel: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.62)",
  },
  walletMetaValue: {
    ...Typography.labelMd,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  quickRow: { gap: Spacing.sm },
  quickTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 72,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { flex: 1, gap: 2, minWidth: 0 },
  quickTitle: { ...Typography.labelMd, fontWeight: "700", fontSize: 16 },
  quickSub: { ...Typography.bodySmall },
});
