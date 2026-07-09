import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/ui/chip-select';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { formatGemType } from '@/constants/gem-options';
import { createTransaction, fetchGems, updateGemStatus } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Timestamp } from '@/lib/firebase/db';
import { friendlyError } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils';
import { parseForm, recordSaleSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

type PaymentMethod = 'transfer' | 'cash' | 'cheque';

const METHODS: { value: PaymentMethod; label: string; icon: IconName }[] = [
  { value: 'transfer', label: 'Transfer', icon: 'account-balance' },
  { value: 'cash', label: 'Cash', icon: 'payments' },
  { value: 'cheque', label: 'Cheque', icon: 'receipt-long' },
];

export default function RecordSaleScreen() {
  const { gemId: gemIdParam } = useLocalSearchParams<{ gemId?: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedGemId, setSelectedGemId] = useState<string | null>(gemIdParam ?? null);
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const sellable = useMemo(() => gems.filter((g) => g.status !== 'sold'), [gems]);
  const gem = useMemo(
    () => gems.find((g) => g.id === selectedGemId) ?? null,
    [gems, selectedGemId],
  );

  const salePrice = parseFloat(price) || 0;
  const costBasis = gem?.totalCost ?? 0;
  const netProfit = salePrice - costBasis;
  const roi = costBasis > 0 ? ((netProfit / costBasis) * 100).toFixed(1) : '0.0';

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleConfirm() {
    if (!user) return;
    const result = parseForm(recordSaleSchema, {
      gemId: selectedGemId ?? '',
      price,
      buyer: buyer || undefined,
      method,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return;
    }
    if (!gem) {
      toast.error('Choose which stone you are selling.');
      return;
    }

    setLoading(true);
    try {
      const data = result.data;
      await createTransaction(user.uid, {
        type: 'income',
        amount: data.price,
        currency: 'LKR',
        category: 'sale',
        description: `Sale of ${gem.sku}${data.buyer ? ` to ${data.buyer}` : ''} (${data.method})`,
        gemId: gem.id,
        contactId: null,
        date: Timestamp.now(),
      });
      await updateGemStatus(gem.id, user.uid, 'sold', `Sold for ${formatCurrency(data.price)}`);
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (data.method === 'cheque') {
        toast.success(`${gem.sku} sold. Add the cheque next.`);
        router.replace({
          pathname: '/(marketplace)/(tabs)/workspace/cheques/add',
          params: { amount: String(data.price), gemId: gem.id },
        });
        return;
      }
      toast.success(`${gem.sku} marked as sold.`);
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not record sale.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Record sale" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.lead, { color: colors.textMuted }]}>
          Log the sale price and update inventory.
        </Text>

        {!gemIdParam ? (
          <FormSection title="Stone" hint="Pick an unsold gem from your vault.">
            {sellable.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No sellable gems. Add inventory first.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}>
                {sellable.map((g) => {
                  const active = g.id === selectedGemId;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        setSelectedGemId(g.id);
                        clearField('gemId');
                      }}
                      style={({ pressed }) => [
                        styles.pickerChip,
                        {
                          backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                          borderColor: active
                            ? colors.primary
                            : errors.gemId
                              ? colors.error
                              : colors.outlineVariant,
                        },
                        pressed && { opacity: 0.9 },
                      ]}>
                      <Text
                        style={[
                          styles.pickerText,
                          { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                        ]}>
                        {g.sku}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {errors.gemId ? (
              <Text style={[styles.fieldError, { color: colors.error }]}>{errors.gemId}</Text>
            ) : null}
          </FormSection>
        ) : null}

        {gem ? (
          <View
            style={[
              styles.gemCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}>
            <View style={[styles.thumb, { backgroundColor: colors.surfaceContainerHigh }]}>
              {gem.photoUrls?.[0] ? (
                <Image source={{ uri: gem.photoUrls[0] }} style={styles.thumbImg} contentFit="cover" />
              ) : (
                <Icon name="diamond" size={28} color={colors.primary} />
              )}
            </View>
            <View style={styles.gemInfo}>
              <Text style={[styles.sku, { color: colors.primary }]} selectable>
                {gem.sku}
              </Text>
              <Text style={[styles.gemName, { color: colors.onSurface }]}>
                {gem.currentWeight} ct {formatGemType(gem.gemType)}
              </Text>
              <Text style={[styles.gemMeta, { color: colors.textMuted }]}>
                Cost basis {formatCurrency(costBasis)}
              </Text>
            </View>
          </View>
        ) : null}

        <FormSection title="Sale details">
          <Input
            label="Final sale price (LKR)"
            value={price}
            onChangeText={(v) => {
              setPrice(v);
              clearField('price');
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="payments"
            error={errors.price}
          />
          <Input
            label="Buyer"
            value={buyer}
            onChangeText={setBuyer}
            placeholder="Optional"
            leftIcon="person"
            error={errors.buyer}
          />
          <ChipSelect
            label="Payment method"
            layout="split"
            options={METHODS}
            value={method}
            onChange={(v) => {
              setMethod(v);
              clearField('method');
            }}
            error={errors.method}
          />
        </FormSection>

        {gem && salePrice > 0 ? (
          <View style={[styles.projection, { backgroundColor: colors.primary }]}>
            <Text style={[styles.projHeading, { color: colors.onPrimary + 'B3' }]}>
              Projection
            </Text>
            <View style={styles.projRow}>
              <View style={styles.projCell}>
                <Text style={[styles.projLabel, { color: colors.onPrimary + '99' }]}>Cost</Text>
                <Text style={[styles.projValue, { color: colors.onPrimary }]} selectable>
                  {formatCurrency(costBasis)}
                </Text>
              </View>
              <View style={styles.projCell}>
                <Text style={[styles.projLabel, { color: colors.onPrimary + '99' }]}>Profit</Text>
                <Text
                  style={[
                    styles.projValue,
                    { color: netProfit >= 0 ? colors.onPrimary : colors.errorContainer },
                  ]}
                  selectable>
                  {netProfit >= 0 ? '+' : ''}
                  {formatCurrency(netProfit)}
                </Text>
              </View>
              <View style={styles.projCell}>
                <Text style={[styles.projLabel, { color: colors.onPrimary + '99' }]}>ROI</Text>
                <Text style={[styles.projValue, { color: colors.onPrimary }]} selectable>
                  {roi}%
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ThemedScrollView>

      <FormFooter
        title={method === 'cheque' ? 'Sell & add cheque' : 'Confirm sale'}
        icon="check-circle"
        loading={loading}
        onPress={handleConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  lead: { ...Typography.bodyMd, lineHeight: 22 },
  empty: { ...Typography.bodyMd },
  pickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  pickerText: { ...Typography.labelMd, fontWeight: '600' },
  fieldError: { ...Typography.bodySmall },
  gemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  gemInfo: { flex: 1, gap: 2 },
  sku: { ...Typography.caption, fontWeight: '700', letterSpacing: 0.4 },
  gemName: { ...Typography.headlineSmMobile },
  gemMeta: { ...Typography.bodySmall },
  projection: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: 12,
  },
  projHeading: { ...Typography.labelMd, fontWeight: '600' },
  projRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  projCell: { flex: 1, gap: 4 },
  projLabel: { ...Typography.caption },
  projValue: {
    ...Typography.headlineSmMobile,
    fontVariant: ['tabular-nums'],
  },
});
