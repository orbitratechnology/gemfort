import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { formatGemType } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createService, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

const SERVICE_TYPES = [
  { id: 'cutting', label: 'Cutting' },
  { id: 'heating', label: 'Heating' },
  { id: 'polishing', label: 'Polishing' },
  { id: 'certification', label: 'Certification' },
  { id: 'recutting', label: 'Recutting' },
  { id: 'appraisal', label: 'Appraisal' },
];

export default function AddServiceScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const { gemId: preselectedGemId } = useLocalSearchParams<{ gemId?: string }>();
  const [gemId, setGemId] = useState(preselectedGemId ?? '');
  const [providerContactId, setProviderContactId] = useState('');
  const [serviceType, setServiceType] = useState('cutting');
  const [weightBefore, setWeightBefore] = useState('');
  const [daysUntilReturn, setDaysUntilReturn] = useState('14');
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

  async function handleSubmit() {
    if (!user || !gemId || !providerContactId) {
      toast.error('Select a gem and a provider.');
      return;
    }
    setLoading(true);
    try {
      const expectedReturn = Timestamp.fromDate(
        new Date(Date.now() + parseInt(daysUntilReturn, 10) * 86400000),
      );
      const id = await createService(user.uid, {
        gemId,
        serviceType,
        providerContactId,
        dateGiven: Timestamp.now(),
        expectedReturnDate: expectedReturn,
        weightBefore: parseFloat(weightBefore) || 0,
        photoBeforeUrls: [],
        instructions: null,
        agreedPrice: null,
        agreedPriceCurrency: null,
        advancePaid: 0,
      });
      toast.success('Service record created');
      router.replace(`/(marketplace)/(tabs)/workspace/services/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Service" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>SELECT GEM</Text>
          {gems.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Add a gem to your inventory first.</Text>
          ) : (
            <View style={styles.chips}>
              {gems.map((g) => {
                const active = gemId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      setGemId(g.id);
                      setWeightBefore(String(g.currentWeight));
                    }}
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

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>SERVICE TYPE</Text>
          <View style={styles.chips}>
            {SERVICE_TYPES.map((t) => {
              const active = serviceType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setServiceType(t.id)}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Weight Before (ct)" value={weightBefore} onChangeText={setWeightBefore} keyboardType="decimal-pad" />
          <Input label="Days Until Return" value={daysUntilReturn} onChangeText={setDaysUntilReturn} keyboardType="number-pad" />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <ContactPicker
            label="Provider"
            contacts={contacts}
            value={providerContactId}
            onChange={setProviderContactId}
            typeFilter="cutter"
            emptyHint="Add a cutter or provider contact first."
          />
        </View>

        <Button title="Create Service Record" loading={loading} onPress={handleSubmit} />
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
