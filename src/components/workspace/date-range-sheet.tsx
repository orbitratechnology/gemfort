import { addMonths, format, isSameDay, isSameMonth, isWithinInterval, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  MONEY_PERIODS,
  type DateRange,
  type MoneyPeriod,
  formatDateRangeLabel,
  getMonthGrid,
  getPeriodRange,
  makeCustomRange,
} from '@/features/workspace/money-utils';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type DateRangeSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Currently applied range (preset or custom). */
  value: DateRange;
  onApply: (range: DateRange, period: MoneyPeriod | null) => void;
  onClear: () => void;
  /** When a preset period is active (null = custom). */
  activePeriod: MoneyPeriod | null;
};

export function DateRangeSheet({
  visible,
  onClose,
  value,
  onApply,
  onClear,
  activePeriod,
}: DateRangeSheetProps) {
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => value.start);
  const [draftStart, setDraftStart] = useState<Date | null>(value.start);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value.end);
  const [preset, setPreset] = useState<MoneyPeriod | 'custom'>(
    activePeriod ?? 'custom',
  );

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setMonth(value.start);
    setDraftStart(value.start);
    setDraftEnd(value.end);
    setPreset(activePeriod ?? 'custom');
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const weeks = useMemo(() => getMonthGrid(month), [month]);

  const rangeHint = useMemo(() => {
    if (draftStart && draftEnd) return formatDateRangeLabel(draftStart, draftEnd);
    if (draftStart) return `${format(draftStart, 'd MMM yyyy')} – …`;
    return 'Tap a start date, then an end date';
  }, [draftStart, draftEnd]);

  const selectDay = (day: Date) => {
    haptics.selection();
    setPreset('custom');

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    if (day < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(day);
      return;
    }
    setDraftEnd(day);
  };

  const applyPreset = (id: MoneyPeriod) => {
    const range = getPeriodRange(id);
    setPreset(id);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setMonth(range.start);
  };

  const handleApply = () => {
    if (!draftStart) return;
    const end = draftEnd ?? draftStart;
    const range = makeCustomRange(draftStart, end);
    if (preset !== 'custom') {
      onApply(getPeriodRange(preset), preset);
    } else {
      onApply(range, null);
    }
    onClose();
  };

  const dayInRange = (day: Date) => {
    if (!draftStart) return false;
    const end = draftEnd ?? draftStart;
    const [from, to] = day < draftStart ? [day, draftStart] : [draftStart, end];
    return isWithinInterval(day, {
      start: from < to ? from : to,
      end: from < to ? to : from,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter by date"
      footer={
        <View style={styles.footer}>
          <Button title="Clear" variant="ghost" onPress={onClear} />
          <Button
            title="Apply"
            onPress={handleApply}
            disabled={!draftStart}
            style={styles.applyBtn}
          />
        </View>
      }
    >
      <FilterChipGroup
        label="Quick select"
        options={MONEY_PERIODS.map((p) => ({ id: p.id, label: p.label }))}
        value={preset === 'custom' ? null : preset}
        onChange={applyPreset}
      />

      <View style={styles.hintRow}>
        <Icon name="date-range" size={18} color={colors.primary} />
        <Text selectable={false} style={[styles.hint, { color: colors.onSurface }]}>
          {rangeHint}
        </Text>
      </View>

      <View style={styles.monthNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
          onPress={() => setMonth((m) => subMonths(m, 1))}
          style={styles.navBtn}
        >
          <Icon name="chevron-left" size={26} color={colors.primary} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.onSurface }]}>
          {format(month, 'MMMM yyyy')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={styles.navBtn}
        >
          <Icon name="chevron-right" size={26} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.calendar}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={`${d}-${i}`} style={[styles.weekday, { color: colors.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.dayCell} />;

              const inMonth = isSameMonth(day, month);
              const isStart = draftStart ? isSameDay(day, draftStart) : false;
              const isEnd = draftEnd ? isSameDay(day, draftEnd) : false;
              const endpoint = isStart || isEnd;
              const inRange = dayInRange(day);
              const today = isSameDay(day, new Date());

              return (
                <Pressable
                  key={format(day, 'yyyy-MM-dd')}
                  onPress={() => selectDay(day)}
                  style={[
                    styles.dayCell,
                    inRange && !endpoint && {
                      backgroundColor: colors.primary + '18',
                    },
                    endpoint && {
                      backgroundColor: colors.primary,
                      borderRadius: Radius.full,
                    },
                    inRange && isStart && draftEnd && styles.rangeStart,
                    inRange && isEnd && draftEnd && styles.rangeEnd,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color: endpoint
                          ? colors.onPrimary
                          : inMonth
                            ? colors.onSurface
                            : colors.outline,
                        fontWeight: today || endpoint ? '700' : '500',
                      },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={[styles.help, { color: colors.textMuted }]}>
        Select a start date, then an end date to filter income and expenses.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  applyBtn: { flex: 1 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hint: { ...Typography.bodyLg, fontWeight: '600', flex: 1 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { ...Typography.headlineSm, fontWeight: '700' },
  calendar: { gap: 4 },
  weekdayRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...Typography.labelMd,
    fontSize: 12,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  rangeStart: {
    borderTopLeftRadius: Radius.full,
    borderBottomLeftRadius: Radius.full,
  },
  rangeEnd: {
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  dayNum: { ...Typography.bodyMd, fontVariant: ['tabular-nums'] },
  help: { ...Typography.bodyMd, textAlign: 'center' },
});
