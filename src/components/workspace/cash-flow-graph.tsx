import { LineGraph, type GraphPoint } from "react-native-graph";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import type { CashFlowBucket } from "@/features/workspace/money-utils";
import { useAppTheme } from "@/hooks/use-app-theme";

type CashFlowGraphProps = {
  buckets: CashFlowBucket[];
  formatAmount: (amount: number) => string;
};

const GRAPH_EPOCH = Date.UTC(2024, 0, 1);

function pointDate(index: number) {
  return new Date(GRAPH_EPOCH + index * 24 * 60 * 60 * 1000);
}

function pointsFor(
  buckets: CashFlowBucket[],
  key: "income" | "expense",
): GraphPoint[] {
  // The graph library requires Date-based x coordinates; bucket labels stay
  // categorical and are rendered below the graph instead.
  const source = buckets.length === 1 ? [...buckets, buckets[0]] : buckets;
  return source.map((bucket, index) => ({
    date: pointDate(index),
    value: bucket[key],
  }));
}

export function CashFlowGraph({ buckets, formatAmount }: CashFlowGraphProps) {
  const { colors } = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const incomePoints = useMemo(() => pointsFor(buckets, "income"), [buckets]);
  const expensePoints = useMemo(() => pointsFor(buckets, "expense"), [buckets]);
  const hasCashFlow = buckets.some(
    (bucket) => bucket.income > 0 || bucket.expense > 0,
  );

  const range = useMemo(() => {
    const maximum = Math.max(
      1,
      ...buckets.flatMap((bucket) => [bucket.income, bucket.expense]),
    );
    const padding = Math.max(maximum * 0.14, 1);
    return {
      y: {
        min: -padding,
        max: maximum + padding,
      },
    };
  }, [buckets]);

  const pointIndexByTime = useMemo(
    () =>
      new Map(
        incomePoints.map((point, index) => [
          point.date.getTime(),
          Math.min(index, Math.max(0, buckets.length - 1)),
        ]),
      ),
    [buckets.length, incomePoints],
  );

  const handlePointSelected = useCallback(
    (point: GraphPoint) => {
      const index = pointIndexByTime.get(point.date.getTime());
      if (index !== undefined) setSelectedIndex(index);
    },
    [pointIndexByTime],
  );

  if (!hasCashFlow || buckets.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Icon name="bar-chart" size={26} color={colors.outline} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No cash flow this period yet
        </Text>
      </View>
    );
  }

  const resolvedIndex = Math.min(
    selectedIndex ?? buckets.length - 1,
    buckets.length - 1,
  );
  const selectedBucket = buckets[resolvedIndex];
  const net = selectedBucket.income - selectedBucket.expense;
  const axisLabels =
    buckets.length > 2
      ? [
          buckets[0].label,
          buckets[Math.floor((buckets.length - 1) / 2)].label,
          buckets[buckets.length - 1].label,
        ]
      : buckets.map((bucket) => bucket.label);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            {selectedBucket.label} · NET CASH FLOW
          </Text>
          <Text
            selectable
            style={[
              styles.summaryValue,
              { color: net >= 0 ? colors.successEmerald : colors.error },
            ]}>
            {net >= 0 ? "+" : "−"}
            {formatAmount(Math.abs(net))}
          </Text>
        </View>
        <Text style={[styles.scrubHint, { color: colors.textMuted }]}>
          Press and hold to explore
        </Text>
      </View>

      <View
        accessible
        accessibilityLabel="Cash flow graph. Press and hold to explore income and expenses."
        style={styles.graphStage}>
        <LineGraph
          animated={false}
          color={colors.warningAmber}
          lineThickness={2.5}
          points={expensePoints}
          range={range}
          style={StyleSheet.absoluteFill}
        />
        <LineGraph
          animated
          color={colors.successEmerald}
          enableFadeInMask
          enableIndicator
          enablePanGesture
          gradientFillColors={[
            colors.successEmerald + "2E",
            colors.successEmerald + "00",
          ]}
          horizontalPadding={12}
          lineThickness={2.5}
          onPointSelected={handlePointSelected}
          panGestureDelay={180}
          points={incomePoints}
          range={range}
          style={StyleSheet.absoluteFill}
          verticalPadding={12}
        />
      </View>

      <View style={styles.axisLabels}>
        {axisLabels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[styles.axisLabel, { color: colors.textMuted }]}>
            {label}
          </Text>
        ))}
      </View>

      <View
        style={[styles.legendRow, { borderTopColor: colors.surfaceVariant }]}>
        <View style={styles.legendItem}>
          <View
            style={[styles.dot, { backgroundColor: colors.successEmerald }]}
          />
          <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>
            Income
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.dot, { backgroundColor: colors.warningAmber }]}
          />
          <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>
            Expenses
          </Text>
        </View>
        <View style={styles.selectedMetrics}>
          <Text
            selectable
            style={[styles.metricText, { color: colors.textMuted }]}>
            In {formatAmount(selectedBucket.income)}
          </Text>
          <Text
            selectable
            style={[styles.metricText, { color: colors.textMuted }]}>
            Out {formatAmount(selectedBucket.expense)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    ...Typography.caption,
    letterSpacing: 0.8,
  },
  summaryValue: {
    ...Typography.headlineSm,
    fontVariant: ["tabular-nums"],
  },
  scrubHint: {
    ...Typography.caption,
    textAlign: "right",
  },
  graphStage: {
    height: 170,
    position: "relative",
  },
  axisLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  axisLabel: {
    ...Typography.caption,
    minWidth: 28,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.gutterMd,
    marginTop: Spacing.sm,
    paddingTop: Spacing.stackMd,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    ...Typography.labelMd,
  },
  selectedMetrics: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  metricText: {
    ...Typography.caption,
    fontVariant: ["tabular-nums"],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sectionGap,
    gap: Spacing.stackMd,
  },
  emptyText: {
    ...Typography.bodyMd,
    textAlign: "center",
  },
});
