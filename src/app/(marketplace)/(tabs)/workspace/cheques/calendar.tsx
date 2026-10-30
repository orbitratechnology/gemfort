import { router } from 'expo-router';
import { addMonths, format, isToday, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Accent, IconBubble, ListItem } from '@/components/ui/detail-kit';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { CHEQUE_STATUS_ACCENT } from '@/components/workspace/cheque-preview-card';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import {
  CHEQUE_STATUS_LABELS,
  getChequesByDayInMonth,
  getChequesForDate,
  getDayTotal,
  getMonthGrid,
} from '@/features/workspace/cheque-utils';
import {
  subscribeCheques,
  subscribeContacts,
} from '@/features/workspace/firestore-subscriptions';
import { fetchCheques, fetchContacts } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { useAuth } from '@/providers/auth-provider';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Day dots: money coming in vs going out. */
const RECEIVED_DOT = Accent.emerald;
const GIVEN_DOT = Accent.amber;

export default function ChequeCalendarScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Date>(() => new Date());

  const { data: cheques = [] } = useFirestoreLiveQuery({
    queryKey: ['cheques', user?.uid],
    queryFn: () => fetchCheques(user!.uid),
    subscribe: (onData, onError) => subscribeCheques(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
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
  const selectedKey = format(selected, 'yyyy-MM-dd');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Cheque Calendar" />

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.band, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setMonth((m) => subMonths(m, 1))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={({ pressed }) => [
                styles.navBtn,
                { backgroundColor: colors.surfaceContainerLow },
                pressed && styles.pressed,
              ]}>
              <Icon name="chevron-left" size={24} color={colors.onSurface} />
            </Pressable>
            <View style={styles.monthCenter}>
              <Text style={[styles.monthTitle, { color: colors.onSurface }]} accessibilityRole="header">
                {format(month, 'MMMM yyyy')}
              </Text>
              <Text style={[styles.monthSub, { color: colors.onSurfaceVariant }]}>
                <Text style={[styles.monthSubStrong, { color: Accent.amber }]}>{formatBase(monthTotal)}</Text>{' '}
                maturing
              </Text>
            </View>
            <Pressable
              onPress={() => setMonth((m) => addMonths(m, 1))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={({ pressed }) => [
                styles.navBtn,
                { backgroundColor: colors.surfaceContainerLow },
                pressed && styles.pressed,
              ]}>
              <Icon name="chevron-right" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={styles.calendar}>
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
                  const isSelected = selectedKey === key;
                  const today = isToday(day);
                  const hasReceived = dayCheques.some((c) => c.direction === 'received');
                  const hasGiven = dayCheques.some((c) => c.direction === 'given');

                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelected(day)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${format(day, 'd MMMM')}${
                        dayCheques.length ? `, ${dayCheques.length} cheque${dayCheques.length === 1 ? '' : 's'}` : ''
                      }`}
                      style={[
                        styles.dayCell,
                        isSelected && { backgroundColor: colors.primary },
                        !isSelected && today && { backgroundColor: colors.surfaceContainerLow },
                      ]}>
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: isSelected
                              ? colors.onPrimary
                              : today
                                ? colors.primary
                                : colors.onSurface,
                          },
                          today && styles.dayNumToday,
                        ]}>
                        {day.getDate()}
                      </Text>
                      {dayCheques.length > 0 ? (
                        <>
                          <View style={styles.dots}>
                            {hasReceived ? (
                              <View style={[styles.dot, { backgroundColor: RECEIVED_DOT }]} />
                            ) : null}
                            {hasGiven ? (
                              <View style={[styles.dot, { backgroundColor: GIVEN_DOT }]} />
                            ) : null}
                          </View>
                          <Text
                            style={[
                              styles.dayAmt,
                              { color: isSelected ? colors.onPrimary : colors.onSurfaceVariant },
                            ]}
                            numberOfLines={1}>
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

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: RECEIVED_DOT }]} />
              <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Taken</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: GIVEN_DOT }]} />
              <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Given</Text>
            </View>
          </View>
        </View>

        <View style={[styles.dayBand, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayTitle, { color: colors.onSurface }]} accessibilityRole="header">
              {format(selected, 'EEEE, d MMM')}
            </Text>
            {selectedCheques.length > 0 ? (
              <Text style={[styles.dayCount, { color: colors.textMuted }]}>
                {selectedCheques.length} cheque{selectedCheques.length === 1 ? '' : 's'}
              </Text>
            ) : null}
          </View>
          {selectedCheques.length === 0 ? (
            <View style={styles.emptyRow}>
              <IconBubble icon="event-available" accent={Accent.slate} />
              <Text style={[styles.empty, { color: colors.textMuted }]}>No cheques maturing this day.</Text>
            </View>
          ) : (
            selectedCheques.map((c, i) => (
              <ListItem
                key={c.id}
                leading={
                  <IconBubble
                    icon={c.direction === 'received' ? 'call-received' : 'call-made'}
                    accent={CHEQUE_STATUS_ACCENT[c.status]}
                    size={44}
                  />
                }
                title={contactMap.get(c.counterpartyContactId) ?? c.issuedBy}
                subtitle={`No. ${c.chequeNumber} · ${c.bankName}`}
                amount={formatStored({
                  amount: c.amount,
                  currency: c.currency,
                  amountBase: c.amountBase,
                })}
                amountColor={c.status === 'bounced' ? Accent.rose : undefined}
                status={{ label: CHEQUE_STATUS_LABELS[c.status], accent: CHEQUE_STATUS_ACCENT[c.status] }}
                onPress={() => router.push(`/(marketplace)/(tabs)/workspace/cheques/${c.id}` as never)}
                isLast={i === selectedCheques.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.section },
  pressed: { opacity: 0.7 },
  band: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: { flex: 1, alignItems: 'center', gap: 2 },
  monthTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  monthSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  monthSubStrong: { fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
  calendar: { gap: 4 },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    ...text,
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  weekRow: { flexDirection: 'row', gap: 4 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 4,
    gap: 2,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  dayNum: { ...text, fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  dayNumToday: { fontFamily: FontFamily.semibold },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayAmt: { ...text, fontFamily: FontFamily.semibold, fontSize: 9, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...text, fontFamily: FontFamily.regular, fontSize: 12 },
  dayBand: { marginTop: 8, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.sm,
  },
  dayTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  dayCount: { ...text, fontFamily: FontFamily.medium, fontSize: 13 },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.md,
  },
  empty: { ...text, fontFamily: FontFamily.regular, fontSize: 14, flex: 1 },
});
