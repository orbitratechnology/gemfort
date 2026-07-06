import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { formatGemType } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createApRecord, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddApScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const { gemId: preselected } = useLocalSearchParams<{ gemId?: string }>();
  const [gemId, setGemId] = useState(preselected ?? '');
  const [holderId, setHolderId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const availableGems = gems.filter((g) => !['on_ap', 'sold'].includes(g.status));

  async function handleSubmit() {
    if (!user || !gemId || !holderId || !minPrice) {
      toast.error('Select a gem, holder, and minimum price.');
      return;
    }
    setLoading(true);
    try {
      const id = await createApRecord(user.uid, {
        gemId,
        apHolderContactId: holderId,
        ownerMinimumPrice: parseFloat(minPrice),
        expectedDurationDays: parseInt(days, 10),
      });
      toast.success('Gem given on AP');
      router.replace(`/(marketplace)/(tabs)/workspace/ap/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to give on AP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Give on AP" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>SELECT GEM</Text>
          {availableGems.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No available gems. Add a gem or free one from another AP first.
            </Text>
          ) : (
            <View style={styles.chips}>
              {availableGems.map((g) => {
                const active = gemId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setGemId(g.id)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                    ]}>
                    <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {g.sku} · {g.currentWeight}ct
                    </Text>
                    <Text style={[styles.chipSub, { color: active ? colors.onPrimary + 'CC' : colors.textMuted }]}>
                      {formatGemType(g.gemType)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Minimum Price (LKR)" value={minPrice} onChangeText={setMinPrice} keyboardType="decimal-pad" placeholder="0.00" />
          <Input label="Expected Days" value={days} onChangeText={setDays} keyboardType="number-pad" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <ContactPicker
            label="AP Holder"
            contacts={contacts}
            value={holderId}
            onChange={setHolderId}
            typeFilter="broker"
            emptyHint="Add a broker or holder contact first."
          />
        </View>

        <Button title="Create AP Record" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.lg, paddingBottom: Spacing.section },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.5 },
  empty: { ...Typography.bodyMd },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  chipText: { ...Typography.labelMd },
  chipSub: { ...Typography.caption, marginTop: 2, textTransform: 'capitalize' },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
});
