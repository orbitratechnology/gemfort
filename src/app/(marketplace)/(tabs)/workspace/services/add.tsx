import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import {
  PickerSelectField,
  ProviderPickerSheet,
  type ProviderSelection,
} from '@/components/workspace/contact-picker-sheet';
import { GemPickerSheet, GemSelectField } from '@/components/workspace/gem-picker-sheet';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createService, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
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
  const [provider, setProvider] = useState<ProviderSelection | null>(null);
  const [serviceType, setServiceType] = useState('cutting');
  const [weightBefore, setWeightBefore] = useState('');
  const [daysUntilReturn, setDaysUntilReturn] = useState('14');
  const [loading, setLoading] = useState(false);
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [providerSheetOpen, setProviderSheetOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const selectedGem = useMemo(
    () => gems.find((g) => g.id === gemId) ?? null,
    [gems, gemId],
  );

  const weightBeforeValue =
    weightBefore || (selectedGem ? String(selectedGem.currentWeight) : '');

  async function handleSubmit() {
    if (!user) return;
    const nextErrors: Record<string, string> = {};
    if (!gemId) nextErrors.gemId = 'Select a gem.';
    if (!provider) nextErrors.provider = 'Select a provider.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]);
      return;
    }
    if (!provider) return;

    setLoading(true);
    try {
      const expectedReturn = Timestamp.fromDate(
        new Date(Date.now() + parseInt(daysUntilReturn, 10) * 86400000),
      );
      const id = await createService(user.uid, {
        gemId,
        serviceType,
        providerContactId: provider.source === 'contact' ? provider.contactId : '',
        providerBusinessId: provider.source === 'business' ? provider.businessId : null,
        providerName: provider.label,
        dateGiven: Timestamp.now(),
        expectedReturnDate: expectedReturn,
        weightBefore: parseFloat(weightBeforeValue) || selectedGem?.currentWeight || 0,
        photoBeforeUrls: [],
        instructions: null,
        agreedPrice: null,
        agreedPriceCurrency: null,
        advancePaid: 0,
      });
      toast.success('Service record created');
      router.replace(`/(marketplace)/(tabs)/workspace/services/${id}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create service.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Service" />
      <ThemedScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GemSelectField
          label="Gem"
          gem={selectedGem}
          onPress={() => setGemSheetOpen(true)}
          error={errors.gemId}
        />

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
                      : {
                          backgroundColor: colors.surfaceContainerLowest,
                          borderColor: colors.outlineVariant,
                        },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                    ]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input
            label="Weight Before (ct)"
            value={weightBeforeValue}
            onChangeText={setWeightBefore}
            keyboardType="decimal-pad"
            leftIcon="scale"
          />
          <Input
            label="Days Until Return"
            value={daysUntilReturn}
            onChangeText={setDaysUntilReturn}
            keyboardType="number-pad"
            leftIcon="schedule"
          />
        </View>

        <PickerSelectField
          label="Provider"
          valueLabel={provider?.label ?? null}
          subtitle={
            provider?.source === 'business'
              ? provider.businessType.replace(/_/g, ' ')
              : provider?.source === 'contact'
                ? 'Saved contact'
                : null
          }
          placeholder="Search labs, lapidaries, or contacts…"
          icon="handyman"
          onPress={() => setProviderSheetOpen(true)}
          error={errors.provider}
        />

        <Button title="Create Service Record" icon="handyman" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={gems}
        value={gemId}
        onSelect={(gem) => {
          setGemId(gem.id);
          setWeightBefore(String(gem.currentWeight));
          setErrors((e) => {
            const next = { ...e };
            delete next.gemId;
            return next;
          });
        }}
      />

      <ProviderPickerSheet
        visible={providerSheetOpen}
        onClose={() => setProviderSheetOpen(false)}
        contacts={contacts}
        value={provider}
        contactTypeFilter={null}
        onSelect={(selection) => {
          setProvider(selection);
          setErrors((e) => {
            const next = { ...e };
            delete next.provider;
            return next;
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.lg, paddingBottom: Spacing.section },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  chipText: { ...Typography.labelMd },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
  },
});
