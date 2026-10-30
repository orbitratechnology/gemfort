import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import type { CashFlowBucket } from '@/features/workspace/money-utils';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

import { useMoneyChartTheme } from './money-chart-theme';

const PLOT_HEIGHT = 168;
const AXIS_WIDTH = 52;
const TOP_PAD = 8;
const BAR_GAP = 2;
const BAR_RADIUS = 4;
const MAX_BAR = 20;
/** Skeleton bar heights (share of the plot) while the first data loads. */
const SKELETON = [0.45, 0.7, 0.35, 0.8, 0.55, 0.65];

/** Round axis maxima; the half-way gridline stays a round number for each. */
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest "nice" number at or above `value`, so the bars fill most of the plot. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  return (NICE_STEPS.find((step) => f <= step) ?? 10) * exp;
}

/** Bar with rounded top corners, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(BAR_RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Index of the bucket to show first: the latest one with any movement. */
function defaultIndex(buckets: CashFlowBucket[]) {
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    if (buckets[i].income > 0 || buckets[i].expense > 0) return i;
  }
  return Math.max(0, buckets.length - 1);
}

/**
 * Income vs expenses per bucket as grouped bars on one shared axis. Tap a
 * column to read its totals; the readout above names the span in full so the
 * short axis labels can stay terse.
 */
export function CashFlowChart({
  buckets,
  formatAmount,
  formatCompact,
  loading,
}: {
  buckets: CashFlowBucket[];
  formatAmount: (amountBase: number) => string;
  formatCompact: (amountBase: number) => string;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const hasData = buckets.some((b) => b.income > 0 || b.expense > 0);
  const selectedIndex = useMemo(() => {
    const index = picked ? buckets.findIndex((b) => b.key === picked) : -1;
    return index >= 0 ? index : defaultIndex(buckets);
  }, [buckets, picked]);
  const selected = buckets[selectedIndex];

  const scaleMax = useMemo(
    () => niceCeil(Math.max(0, ...buckets.flatMap((b) => [b.income, b.expense]))),
    [buckets],
  );

  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const slot = buckets.length > 0 ? plotWidth / buckets.length : 0;
  const barWidth = Math.max(3, Math.min(MAX_BAR, (slot * 0.62 - BAR_GAP) / 2));
  const usable = PLOT_HEIGHT - TOP_PAD;
  const heightOf = (value: number) =>
    value <= 0 ? 0 : Math.max(2, (value / scaleMax) * usable);
  const ticks = [scaleMax, scaleMax / 2, 0];
  const labelEvery = buckets.length <= 8 ? 1 : Math.ceil(buckets.length / 6);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };

  if (!loading && (!hasData || buckets.length === 0)) {
    return (
      <View style={styles.empty}>
        <Icon name="bar-chart" size={26} color={colors.outline} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No money in or out in this period yet
        </Text>
      </View>
    );
  }

  const net = selected ? selected.income - selected.expense : 0;

  return (
    <View style={styles.container}>
      {selected && hasData ? (
        <View style={styles.readout} accessibilityLiveRegion="polite">
          <View style={styles.readoutHead}>
            <Text
              style={[styles.readoutTitle, { color: colors.onSurfaceVariant }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {selected.title}
            </Text>
            <Text
              style={[styles.readoutNet, { color: colors.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {net > 0 ? '+' : net < 0 ? '−' : ''}
              {formatAmount(Math.abs(net))}
              <Text style={[styles.readoutNetLabel, { color: colors.textMuted }]}> net</Text>
            </Text>
          </View>
          <View style={styles.readoutSplit}>
            <SeriesFigure
              color={chart.income}
              label="In"
              value={formatAmount(selected.income)}
            />
            <SeriesFigure
              color={chart.expense}
              label="Out"
              value={formatAmount(selected.expense)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.readoutPlaceholder}>
          <View style={[styles.placeholderLine, { width: 90, backgroundColor: chart.track }]} />
          <View style={[styles.placeholderLine, styles.placeholderTall, { backgroundColor: chart.track }]} />
        </View>
      )}

      <View onLayout={onLayout} style={styles.stage}>
        {width > 0 ? (
          <Animated.View
            key={`${buckets.length}-${buckets[0]?.key ?? ''}`}
            entering={FadeIn.duration(220)}
            style={{ opacity: loading ? 0.35 : 1 }}
          >
            <Svg width={width} height={PLOT_HEIGHT}>
              {selected && !loading ? (
                <Rect
                  x={AXIS_WIDTH + selectedIndex * slot + 2}
                  y={0}
                  width={Math.max(0, slot - 4)}
                  height={PLOT_HEIGHT}
                  rx={Radius.lg}
                  fill={chart.highlight}
                  opacity={0.7}
                />
              ) : null}
              {ticks.map((tick) => {
                const y = TOP_PAD + usable - (tick / scaleMax) * usable;
                return (
                  <Line
                    key={tick}
                    x1={AXIS_WIDTH}
                    x2={width}
                    y1={y}
                    y2={y}
                    stroke={chart.grid}
                    strokeWidth={tick === 0 ? 1 : StyleSheet.hairlineWidth}
                    strokeDasharray={tick === 0 ? undefined : '3 4'}
                  />
                );
              })}
              {buckets.flatMap((bucket, i) => {
                const center = AXIS_WIDTH + i * slot + slot / 2;
                const skeleton = loading && !hasData;
                const incomeH = skeleton ? usable * SKELETON[i % SKELETON.length] : heightOf(bucket.income);
                const expenseH = skeleton
                  ? usable * SKELETON[(i + 3) % SKELETON.length]
                  : heightOf(bucket.expense);
                const opacity = loading || i === selectedIndex ? 1 : 0.5;
                return [
                  incomeH > 0 ? (
                    <Path
                      key={`${bucket.key}-in`}
                      opacity={opacity}
                      fill={loading ? chart.track : chart.income}
                      d={barPath(center - BAR_GAP / 2 - barWidth, TOP_PAD + usable - incomeH, barWidth, incomeH)}
                    />
                  ) : null,
                  expenseH > 0 ? (
                    <Path
                      key={`${bucket.key}-out`}
                      opacity={opacity}
                      fill={loading ? chart.track : chart.expense}
                      d={barPath(center + BAR_GAP / 2, TOP_PAD + usable - expenseH, barWidth, expenseH)}
                    />
                  ) : null,
                ];
              })}
            </Svg>
          </Animated.View>
        ) : null}

        {/* Axis labels as native Text so they scale with the system font. */}
        <View pointerEvents="none" style={styles.yAxis}>
          {ticks.map((tick) => (
            <Text
              key={tick}
              style={[
                styles.yLabel,
                { color: colors.textMuted, top: TOP_PAD + usable - (tick / scaleMax) * usable - 8 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {tick === 0 ? '0' : formatCompact(tick)}
            </Text>
          ))}
        </View>

        {/* Full-height hit targets, one per bucket. */}
        <View style={[styles.hitRow, { left: AXIS_WIDTH }]}>
          {buckets.map((bucket, i) => (
            <Pressable
              key={bucket.key}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ selected: i === selectedIndex }}
              accessibilityLabel={`${bucket.title}: in ${formatAmount(bucket.income)}, out ${formatAmount(bucket.expense)}`}
              onPress={() => {
                if (i === selectedIndex) return;
                haptics.selection();
                setPicked(bucket.key);
              }}
              style={styles.hit}
            />
          ))}
        </View>
      </View>

      <View style={[styles.xAxis, { paddingLeft: AXIS_WIDTH }]}>
        {buckets.map((bucket, i) => (
          <Text
            key={bucket.key}
            style={[
              styles.xLabel,
              {
                color: i === selectedIndex ? colors.onSurface : colors.textMuted,
                fontFamily: i === selectedIndex ? FontFamily.semibold : FontFamily.medium,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {i % labelEvery === 0 || i === selectedIndex ? bucket.label : ''}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendKey color={chart.income} label="Income" />
        <LegendKey color={chart.expense} label="Expenses" />
        <Text style={[styles.legendHint, { color: colors.textMuted }]} numberOfLines={1}>
          Tap a bar for details
        </Text>
      </View>
    </View>
  );
}

function SeriesFigure({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.figure}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[styles.figureLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[styles.figureValue, { color: colors.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.legendKey}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  readout: { gap: 6 },
  readoutHead: { gap: 2 },
  readoutTitle: { ...text, fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
  readoutNet: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  readoutNetLabel: { fontFamily: FontFamily.medium, fontSize: 13, letterSpacing: 0 },
  readoutSplit: { flexDirection: 'row', gap: Spacing.lg },
  figure: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  figureLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 12 },
  figureValue: {
    ...text,
    flexShrink: 1,
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },

  readoutPlaceholder: { gap: 8, paddingVertical: 4 },
  placeholderLine: { height: 12, borderRadius: Radius.sm },
  placeholderTall: { height: 26, width: 160 },
  stage: { height: PLOT_HEIGHT, position: 'relative' },
  yAxis: { position: 'absolute', left: 0, top: 0, bottom: 0, width: AXIS_WIDTH - 6 },
  yLabel: {
    ...text,
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: FontFamily.medium,
    fontSize: 10,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  hitRow: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  hit: { flex: 1 },

  xAxis: { flexDirection: 'row', marginTop: -4 },
  xLabel: { ...text, flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, lineHeight: 14 },

  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: 4 },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...text, fontFamily: FontFamily.medium, fontSize: 12 },
  legendHint: { ...text, flex: 1, minWidth: 0, textAlign: 'right', fontSize: 11 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sectionGap, gap: Spacing.md },
  emptyText: { ...text, fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center' },
});
