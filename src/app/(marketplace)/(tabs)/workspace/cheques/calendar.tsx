import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  getChequesByDayInMonth,
  getChequesForDate,
  getDayTotal,
  getMonthGrid,
} from '@/features/workspace/cheque-utils';
import { fetchCheques, fetchContacts } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ChequeCalendarScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Date>(() => new Date());

  const { data: cheques = [] } = useQuery({
    queryKey: ['cheques', user?.uid],
    queryFn: () => fetchCheques(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c.displayName])), [contacts]);
  const byDay = useMemo(() => getChequesByDayInMonth(cheques, month), [cheques, month]);
  const weeks = useMemo(() => getMonthGrid(month), [month]);
  const selectedCheques = useMemo(() => getChequesForDate(cheques, selected), [cheques, selected]);

  const monthTotal = useMemo(() => {
    let total = 0;
    byDay.forEach((list) => {
      total += getDayTotal(list);
    });
    return total;
  }, [byDay]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Cheque Calendar" />

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.monthNav}>
          <Pressable onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={12}>
            <Icon name="chevron-left" size={28} color={colors.primary} />
          </Pressable>
          <View style={styles.monthCenter}>
            <Text style={[styles.monthTitle, { color: colors.primary }]}>{format(month, 'MMMM yyyy')}</Text>
            <Text style={[styles.monthSub, { color: colors.textMuted }]}>
              {formatCurrency(monthTotal)} maturing
            </Text>
          </View>
          <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={12}>
            <Icon name="chevron-right" size={28} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.calendar, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
                {d}
              </Text>
            ))}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.dayCell} />;
                const key = format(day, 'yyyy-MM-dd');
                const dayCheques = byDay.get(key) ?? [];
                const total = getDayTotal(dayCheques);
                const isSelected = format(selected, 'yyyy-MM-dd') === key;
                const hasReceived = dayCheques.some((c) => c.direction === 'received');
                const hasGiven = dayCheques.some((c) => c.direction === 'given');

                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelected(day)}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.primaryContainer, borderRadius: Radius.md },
                    ]}>
                    <Text
                      style={[
                        styles.dayNum,
                        { color: isSelected ? colors.onPrimaryContainer : colors.onSurface },
                      ]}>
                      {day.getDate()}
                    </Text>
                    {dayCheques.length > 0 ? (
                      <>
                        <View style={styles.dots}>
                          {hasReceived ? (
                            <View style={[styles.dot, { backgroundColor: colors.successEmerald }]} />
                          ) : null}
                          {hasGiven ? (
                            <View style={[styles.dot, { backgroundColor: colors.warningAmber }]} />
                          ) : null}
                        </View>
                        <Text style={[styles.dayAmt, { color: colors.primary }]} numberOfLines={1}>
                          {(total / 1000).toFixed(0)}k
                        </Text>
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            {format(selected, 'EEEE, d MMM')}
          </Text>
          {selectedCheques.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No cheques maturing this day.</Text>
          ) : (
            selectedCheques.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(marketplace)/(tabs)/workspace/cheques/${c.id}` as never)}
                style={({ pressed }) => [
                  styles.chequeItem,
                  { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={styles.chequeItemTop}>
                  <Text style={[styles.chequeNum, { color: colors.onSurface }]}>{c.chequeNumber}</Text>
                  <Text style={[styles.chequeAmt, { color: colors.primary }]} selectable>
                    {formatCurrency(c.amount, c.currency)}
                  </Text>
                </View>
                <Text style={[styles.chequeBank, { color: colors.textMuted }]}>
                  {c.bankName} · {contactMap.get(c.counterpartyContactId) ?? c.issuedBy}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthCenter: { alignItems: 'center', gap: 2 },
  monthTitle: { ...Typography.headlineMdMobile, fontWeight: '700' },
  monthSub: { ...Typography.bodySmall },
  calendar: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...Typography.labelMd,
    fontSize: 10,
    fontWeight: '600',
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 4,
    gap: 2,
  },
  dayNum: { ...Typography.labelMd, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayAmt: { ...Typography.labelMd, fontSize: 9, fontWeight: '700' },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.headlineMdMobile, fontWeight: '700' },
  empty: { ...Typography.bodySmall, paddingVertical: Spacing.md },
  chequeItem: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 4,
  },
  chequeItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chequeNum: { ...Typography.labelMd, fontWeight: '600' },
  chequeAmt: { ...Typography.labelMd, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chequeBank: { ...Typography.bodySmall },
});
