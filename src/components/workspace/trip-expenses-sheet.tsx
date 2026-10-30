import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Accent,
  DetailRows,
  IconBubble,
  TotalRow,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  getExpenseCategoryIcon,
  getExpenseCategoryLabel,
  getTripPaymentMethodLabel,
} from "@/constants/trip-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { formatRelativeTime } from "@/lib/utils";
import type { TripExpense } from "@/types";

type FormatStored = ReturnType<typeof usePreferredMoney>["formatStored"];

/**
 * One expense as a detail row: category bubble, category + when / how paid /
 * note, amount on the right. Shared by the sheet and the trip detail band.
 */
export function tripExpenseRow(
  e: TripExpense,
  formatStored: FormatStored,
): { key: string } & DetailRowProps {
  const hint = [
    formatRelativeTime(e.date),
    e.paymentMethod ? getTripPaymentMethodLabel(e.paymentMethod) : null,
    e.description?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    key: e.id,
    icon: getExpenseCategoryIcon(e.category),
    accent: Accent.amber,
    label: getExpenseCategoryLabel(e.category),
    hint,
    value: formatStored({
      amount: e.amount,
      currency: e.currency,
      amountBase: e.amountBase,
    }),
  };
}

type TripExpensesSheetProps = {
  visible: boolean;
  onClose: () => void;
  expenses: TripExpense[];
  onAddExpense?: () => void;
};

/** Every expense logged on a trip, with the running total. */
export function TripExpensesSheet({
  visible,
  onClose,
  expenses,
  onAddExpense,
}: TripExpensesSheetProps) {
  const { colors } = useAppTheme();
  const { formatStored, formatBase } = usePreferredMoney();
  const total = expenses.reduce((s, e) => s + e.amountBase, 0);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={expenses.length ? `Expenses · ${expenses.length}` : "Expenses"}
      footer={
        onAddExpense ? (
          <Button
            title="Add expense"
            icon="add"
            onPress={() => {
              onClose();
              onAddExpense();
            }}
          />
        ) : undefined
      }
    >
      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <IconBubble icon="receipt" accent={Accent.amber} size={52} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No expenses yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Log flights, stays, and other trip costs.
          </Text>
        </View>
      ) : (
        <View>
          <DetailRows rows={expenses.map((e) => tripExpenseRow(e, formatStored))} />
          <TotalRow label="Total expenses" value={formatBase(total)} />
        </View>
      )}
    </BottomSheet>
  );
}

/** Compact trigger that opens the expenses sheet. */
export function TripExpensesButton({
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
      accessibilityLabel={`Expenses, ${count}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: colors.surfaceContainerLow },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Icon name="receipt" size={20} color={Accent.amber} />
      <Text style={[styles.triggerLabel, { color: colors.onSurface }]}>
        Expenses
      </Text>
      {count > 0 ? (
        <View style={[styles.countBadge, { backgroundColor: `${Accent.amber}1F` }]}>
          <Text style={[styles.countText, { color: Accent.amber }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, marginTop: Spacing.xs },
  emptySub: { ...text, ...Typography.bodySmall, textAlign: "center" },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    minHeight: 44,
  },
  triggerLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 14 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    minWidth: 22,
    alignItems: "center",
  },
  countText: { ...text, fontFamily: FontFamily.semibold, fontSize: 11 },
});
