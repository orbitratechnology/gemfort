import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  getExpenseCategoryIcon,
  getExpenseCategoryLabel,
  getTripPaymentMethodLabel,
} from "@/constants/trip-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { formatRelativeTime } from "@/lib/utils";
import type { TripExpense } from "@/types";

type TripExpensesSheetProps = {
  visible: boolean;
  onClose: () => void;
  expenses: TripExpense[];
  onAddExpense?: () => void;
};

/** Timeline-style expense list for a trip (matches gem History rail). */
export function TripExpensesSheet({
  visible,
  onClose,
  expenses,
  onAddExpense,
}: TripExpensesSheetProps) {
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Expenses"
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
          <Icon name="receipt" size={28} color={colors.outlineVariant} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No expenses yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Log flights, stays, and other trip costs.
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {expenses.map((e, i) => (
            <View key={e.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineIconWrap,
                    {
                      backgroundColor:
                        i === 0
                          ? colors.primaryContainer
                          : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  <Icon
                    name={getExpenseCategoryIcon(e.category)}
                    size={14}
                    color={
                      i === 0
                        ? colors.onPrimaryContainer
                        : colors.onSurfaceVariant
                    }
                  />
                </View>
                {i < expenses.length - 1 ? (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.timelineBody}>
                <Text
                  style={[styles.timelineDate, { color: colors.textMuted }]}
                >
                  {formatRelativeTime(e.date)}
                  {e.paymentMethod
                    ? ` · ${getTripPaymentMethodLabel(e.paymentMethod)}`
                    : ""}
                </Text>
                <Text
                  style={[styles.timelineTitle, { color: colors.onSurface }]}
                >
                  {getExpenseCategoryLabel(e.category)}
                </Text>
                {e.description ? (
                  <Text
                    style={[
                      styles.timelineMeta,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={2}
                  >
                    {e.description}
                  </Text>
                ) : null}
                <Text
                  style={[styles.timelineAmt, { color: colors.onSurface }]}
                >
                  {formatStored({
                    amount: e.amount,
                    currency: e.currency,
                    amountBase: e.amountBase,
                  })}
                </Text>
              </View>
            </View>
          ))}
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
      <Icon name="receipt" size={20} color={colors.primary} />
      <Text style={[styles.triggerLabel, { color: colors.onSurface }]}>
        Expenses
      </Text>
      {count > 0 ? (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Text
            style={[styles.countText, { color: colors.onPrimaryContainer }]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
  timeline: { gap: 0, paddingHorizontal: Spacing.xs },
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 64 },
  timelineRail: { width: 28, alignItems: "center" },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: 0 },
  timelineBody: { flex: 1, paddingBottom: Spacing.md, gap: 2, paddingTop: 4 },
  timelineDate: { ...Typography.caption },
  timelineTitle: { ...Typography.bodyMd, fontWeight: "600" },
  timelineMeta: { ...Typography.bodySmall },
  timelineAmt: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
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
