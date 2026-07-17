import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { CHEQUE_STATUS_LABELS, maturityLabel } from '@/features/workspace/cheque-utils';
import {
  fetchCheque,
  fetchContacts,
  updateChequeStatus,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { formatCurrency, formatDate, formatRelativeDue, formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/providers/toast-provider';
import type { ChequeStatus } from '@/types';

const STATUS_ACTIONS: { status: ChequeStatus; label: string; icon: 'account-balance' | 'check-circle' | 'cancel' | 'swap-horiz' }[] = [
  { status: 'deposited', label: 'Mark deposited', icon: 'account-balance' },
  { status: 'cleared', label: 'Mark cleared', icon: 'check-circle' },
  { status: 'bounced', label: 'Mark bounced', icon: 'cancel' },
  { status: 'cancelled', label: 'Cancel', icon: 'cancel' },
];

export default function ChequeDetailScreen() {
  const { chequeId } = useLocalSearchParams<{ chequeId: string }>();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [bounceReason, setBounceReason] = useState('');
  const [showBounceForm, setShowBounceForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: cheque, isLoading } = useQuery({
    queryKey: ['cheque', chequeId],
    queryFn: () => fetchCheque(chequeId!),
    enabled: !!chequeId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => fetchContacts(cheque!.ownerUid),
    enabled: !!cheque?.ownerUid,
  });

  const contactName =
    contacts.find((c) => c.id === cheque?.counterpartyContactId)?.displayName ?? cheque?.issuedBy ?? '—';

  async function handleStatus(status: ChequeStatus) {
    if (!cheque) return;

    if (status === 'bounced') {
      setShowBounceForm(true);
      return;
    }

    if (status === 'cancelled') {
      Alert.alert('Cancel cheque', 'Mark this cheque as cancelled?', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: () => applyStatus('cancelled') },
      ]);
      return;
    }

    await applyStatus(status);
  }

  async function applyStatus(status: ChequeStatus, reason?: string) {
    if (!cheque) return;
    setLoading(true);
    try {
      await updateChequeStatus(cheque.id, status, reason ? { bouncedReason: reason } : undefined);
      await queryClient.invalidateQueries({ queryKey: ['cheques'] });
      await queryClient.invalidateQueries({ queryKey: ['cheque', chequeId] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Cheque marked as ${CHEQUE_STATUS_LABELS[status].toLowerCase()}.`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update status.'));
    } finally {
      setLoading(false);
    }
  }

  function handleReplace() {
    if (!cheque) return;
    router.push({
      pathname: '/(marketplace)/(tabs)/workspace/cheques/add',
      params: {
        amount: String(cheque.amount),
        contactId: cheque.counterpartyContactId,
        gemId: cheque.gemId ?? undefined,
        apRecordId: cheque.apRecordId ?? undefined,
      },
    });
  }

  if (isLoading || !cheque) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <StackHeader title="Cheque" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBounced = cheque.status === 'bounced';
  const isPending = cheque.status === 'holding' || cheque.status === 'deposited';
  const isReceived = cheque.direction === 'received';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Cheque Detail" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: isBounced ? colors.errorContainer : colors.primary,
            },
          ]}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: isBounced ? colors.error + '22' : colors.onPrimary + '22' },
              ]}>
              <Icon name="money-check-dollar" size={28} color={isBounced ? colors.error : colors.onPrimary} />
            </View>
            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.statusText, { color: isBounced ? colors.error : colors.onSurfaceVariant }]}>
                {CHEQUE_STATUS_LABELS[cheque.status]}
              </Text>
            </View>
          </View>
          <Text style={[styles.heroAmount, { color: isBounced ? colors.error : colors.onPrimary }]} selectable>
            {formatCurrency(cheque.amount, cheque.currency)}
          </Text>
          <Text style={[styles.heroBank, { color: isBounced ? colors.onErrorContainer : colors.onPrimary + 'CC' }]}>
            {cheque.chequeNumber} · {cheque.bankName}
          </Text>
          <Text style={[styles.heroMeta, { color: isBounced ? colors.onErrorContainer : colors.onPrimary + 'AA' }]}>
            {isReceived ? 'From' : 'To'} {contactName} · {maturityLabel(cheque)}
          </Text>
        </View>
        </ScreenInset>

        <FormSection title="Details">
          <DetailRow label="Direction" value={isReceived ? 'Received' : 'Given'} colors={colors} />
          <DetailRow label="Issued by" value={cheque.issuedBy} colors={colors} />
          <DetailRow label="Issue date" value={formatDate(cheque.issueDate)} colors={colors} />
          <DetailRow label="Maturity" value={formatRelativeDue(cheque.maturityDate)} colors={colors} />
          {cheque.branch ? <DetailRow label="Branch" value={cheque.branch} colors={colors} /> : null}
          {cheque.depositedDate ? (
            <DetailRow label="Deposited" value={formatRelativeTime(cheque.depositedDate)} colors={colors} />
          ) : null}
          {cheque.clearedDate ? (
            <DetailRow label="Cleared" value={formatRelativeTime(cheque.clearedDate)} colors={colors} />
          ) : null}
          {cheque.bouncedReason ? (
            <DetailRow label="Bounce reason" value={cheque.bouncedReason} colors={colors} danger />
          ) : null}
          {cheque.notes ? <DetailRow label="Notes" value={cheque.notes} colors={colors} /> : null}
        </FormSection>

        {cheque.photoUrl ? (
          <FormSection title="Cheque photo" padded={false}>
          <View style={styles.photoWrap}>
            <Image source={{ uri: cheque.photoUrl }} style={styles.photo} resizeMode="contain" />
          </View>
          </FormSection>
        ) : null}

        {showBounceForm ? (
          <FormSection title="Bounce reason">
            <Input
              label="Why did it bounce?"
              value={bounceReason}
              onChangeText={setBounceReason}
              placeholder="Insufficient funds, signature mismatch…"
              leftIcon="notes"
            />
            <View style={styles.bounceActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowBounceForm(false)} />
              <Button
                title="Confirm bounce"
                icon="cancel"
                loading={loading}
                onPress={() => {
                  if (!bounceReason.trim()) {
                    toast.error('Enter a reason for the bounce.');
                    return;
                  }
                  void applyStatus('bounced', bounceReason).then(() => setShowBounceForm(false));
                }}
              />
            </View>
          </FormSection>
        ) : null}

        {isPending && !showBounceForm ? (
          <>
            <FormSectionLabel title="Update status" />
            <ScreenInset>
            <View style={styles.actionGrid}>
              {STATUS_ACTIONS.filter((a) =>
                cheque.status === 'holding'
                  ? ['deposited', 'cleared', 'bounced', 'cancelled'].includes(a.status)
                  : ['cleared', 'bounced', 'cancelled'].includes(a.status),
              ).map((a) => (
                <Pressable
                  key={a.status}
                  onPress={() => handleStatus(a.status)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor:
                        a.status === 'bounced' || a.status === 'cancelled'
                          ? colors.errorContainer
                          : colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Icon
                    name={a.icon}
                    size={20}
                    color={a.status === 'bounced' || a.status === 'cancelled' ? colors.error : colors.primary}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      {
                        color:
                          a.status === 'bounced' || a.status === 'cancelled'
                            ? colors.error
                            : colors.onSurface,
                      },
                    ]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            </ScreenInset>
          </>
        ) : null}

        {isBounced ? (
          <ScreenInset>
          <Button title="Add replacement cheque" icon="swap-horiz" variant="secondary" onPress={handleReplace} />
          </ScreenInset>
        ) : null}

        {cheque.gemId ? (
          <ScreenInset>
          <Pressable
            onPress={() => router.push(`/(marketplace)/(tabs)/workspace/gems/${cheque.gemId}`)}
            style={({ pressed }) => [
              styles.linkRow,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
              pressed && { opacity: 0.85 },
            ]}>
            <Icon name="diamond" size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary }]}>View linked gem</Text>
            <Icon name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
          </ScreenInset>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  colors,
  danger,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  danger?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: danger ? colors.error : colors.onSurface }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.section, gap: Spacing.lg },
  hero: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  statusText: { ...Typography.labelMd, fontWeight: '600' },
  heroAmount: { ...Typography.displayLg, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroBank: { ...Typography.labelMd, fontWeight: '600' },
  heroMeta: { ...Typography.bodySmall },
  detailRow: { gap: 2 },
  detailLabel: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { ...Typography.bodyMd },
  photoWrap: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg, borderCurve: 'continuous' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 44,
  },
  actionLabel: { ...Typography.labelMd, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  linkText: { ...Typography.labelMd, fontWeight: '600', flex: 1 },
  bounceActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
});
