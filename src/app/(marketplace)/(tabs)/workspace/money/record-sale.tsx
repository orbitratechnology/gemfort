import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { formatGemType } from '@/constants/gem-options';
import { createTransaction, fetchGems, updateGemStatus } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Timestamp } from '@/lib/firebase/db';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

type PaymentMethod = 'transfer' | 'cash' | 'cheque';
const METHODS: { id: PaymentMethod; label: string; icon: IconName }[] = [
  { id: 'transfer', label: 'Transfer', icon: 'account-balance' },
  { id: 'cash', label: 'Cash', icon: 'payments' },
  { id: 'cheque', label: 'Cheque', icon: 'receipt-long' },
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

  async function handleConfirm() {
    if (!user || !gem) {
      toast.error('Choose which stone you are selling.');
      return;
    }
    if (!salePrice) {
      toast.error('Enter the final sale price.');
      return;
    }
    setLoading(true);
    try {
      await createTransaction(user.uid, {
        type: 'income',
        amount: salePrice,
        currency: 'LKR',
        category: 'sale',
        description: `Sale of ${gem.sku}${buyer ? ` to ${buyer}` : ''} (${method})`,
        gemId: gem.id,
        contactId: null,
        date: Timestamp.now(),
      });
      await updateGemStatus(gem.id, user.uid, 'sold', `Sold for ${formatCurrency(salePrice)}`);
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`${gem.sku} marked as sold and logged to your ledger.`);
      router.back();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record sale');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Record Sale" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.primary }]}>Record Stone Sale</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Finalize the transaction and update your vault ledger.
          </Text>
        </View>

        {/* Gem picker (when not preselected) */}
        {!gemIdParam ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {sellable.map((g) => {
              const active = g.id === selectedGemId;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGemId(g.id)}
                  style={[
                    styles.pickerChip,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                  ]}>
                  <Text style={[styles.pickerText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {g.sku}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Gem summary */}
        {gem ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.gemRow}>
              <View style={[styles.gemThumbWrap, { backgroundColor: colors.surfaceContainerHigh }]}>
                {gem.photoUrls?.[0] ? (
                  <Image source={{ uri: gem.photoUrls[0] }} style={styles.gemThumb} />
                ) : (
                  <Icon name="diamond" size={32} color={colors.primary} />
                )}
              </View>
              <View style={styles.gemInfo}>
                <View style={[styles.stockBadge, { backgroundColor: colors.secondaryContainer }]}>
                  <Text style={[styles.stockText, { color: colors.onSecondaryContainer }]}>STOCK ID: {gem.sku}</Text>
                </View>
                <Text style={[styles.gemName, { color: colors.primary }]}>
                  {gem.currentWeight}ct {formatGemType(gem.gemType)}
                </Text>
                <Text style={[styles.gemOrigin, { color: colors.textMuted }]}>
                  Origin: {gem.originCountry || 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={[styles.gemSpecRow, { borderTopColor: colors.surfaceVariant }]}>
              <View>
                <Text style={[styles.specLabel, { color: colors.textMuted }]}>WEIGHT</Text>
                <Text style={[styles.specValue, { color: colors.onSurface }]}>{gem.currentWeight} ct</Text>
              </View>
              <View>
                <Text style={[styles.specLabel, { color: colors.textMuted }]}>SHAPE</Text>
                <Text style={[styles.specValue, { color: colors.onSurface }]}>{gem.shape || gem.cutType || '—'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Sale details */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>SALE DETAILS</Text>

          <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Final Sale Price (LKR)</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>Rs</Text>
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Buyer / Client</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              value={buyer}
              onChangeText={setBuyer}
              placeholder="Search or add new client..."
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Payment Method</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  style={[
                    styles.methodBtn,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                  ]}>
                  <Icon name={m.icon} size={18} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                  <Text style={[styles.methodText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Financial projection */}
        <View style={[styles.projection, { backgroundColor: colors.primary }]}>
          <Text style={[styles.projHeading, { color: colors.onPrimary + '99' }]}>FINANCIAL PROJECTION</Text>
          <View style={styles.projRow}>
            <View>
              <Text style={[styles.projLabel, { color: colors.onPrimary + 'AA' }]}>COST BASIS</Text>
              <Text style={[styles.projValue, { color: colors.onPrimary }]}>{formatCurrency(costBasis)}</Text>
            </View>
            <View>
              <Text style={[styles.projLabel, { color: colors.onPrimary + 'AA' }]}>NET PROFIT</Text>
              <Text style={[styles.projValue, { color: netProfit >= 0 ? colors.accent : colors.error }]}>
                {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
              </Text>
            </View>
            <View>
              <Text style={[styles.projLabel, { color: colors.onPrimary + 'AA' }]}>EST. ROI</Text>
              <Text style={[styles.projValue, { color: colors.onPrimary }]}>{roi}%</Text>
            </View>
          </View>
        </View>

        {/* Confirm */}
        <Pressable
          onPress={handleConfirm}
          disabled={loading}
          style={({ pressed }) => [
            styles.confirmBtn,
            { backgroundColor: colors.secondaryContainer },
            (pressed || loading) && { opacity: 0.8 },
          ]}>
          <Icon name="check-circle" size={20} color={colors.onSecondaryContainer} />
          <Text style={[styles.confirmText, { color: colors.onSecondaryContainer }]}>
            Confirm Sale &amp; Update Inventory
          </Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.textMuted }]}>
          {gem ? `Transaction will be logged to '${gem.sku}' and the stone marked as SOLD.` : 'Select a stone to continue.'}
        </Text>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { ...Typography.headlineMdMobile },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing.containerMargin, gap: Spacing.gutterMd, paddingBottom: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { ...Typography.labelMd, letterSpacing: 0.5 },
  titleWrap: { gap: 4 },
  title: { ...Typography.headlineSm },
  subtitle: { ...Typography.bodyMd },

  pickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  pickerChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  pickerText: { ...Typography.labelMd },

  card: {
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  gemRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  gemThumbWrap: { width: 80, height: 80, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  gemThumb: { width: '100%', height: '100%' },
  gemInfo: { flex: 1, gap: 4 },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  stockText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  gemName: { ...Typography.headlineSmMobile },
  gemOrigin: { ...Typography.bodyMd },
  gemSpecRow: { flexDirection: 'row', gap: 48, borderTopWidth: 1, paddingTop: 12 },
  specLabel: { ...Typography.labelMd, marginBottom: 2 },
  specValue: { ...Typography.bodyLg, fontWeight: '600' },

  sectionLabel: { ...Typography.labelMd, letterSpacing: 1 },
  fieldLabel: { ...Typography.labelMd, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 50,
  },
  inputPrefix: { ...Typography.bodyLg },
  input: { flex: 1, ...Typography.bodyLg },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  methodText: { ...Typography.labelMd },

  projection: { borderRadius: Radius.lg, padding: 20, gap: 12 },
  projHeading: { ...Typography.labelMd, letterSpacing: 1 },
  projRow: { flexDirection: 'row', justifyContent: 'space-between' },
  projLabel: { ...Typography.labelMd, marginBottom: 4, fontSize: 10 },
  projValue: { ...Typography.headlineSmMobile },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  confirmText: { ...Typography.button },
  note: { ...Typography.bodyMd, textAlign: 'center', fontSize: 12 },
});
