import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { GemPickerSheet, GemSelectField } from '@/components/workspace/gem-picker-sheet';
import { Spacing } from '@/constants/design-tokens';
import { createApRecord, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
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
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
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

  const availableGems = useMemo(
    () => gems.filter((g) => !['on_ap', 'sold'].includes(g.status)),
    [gems],
  );

  const selectedGem = useMemo(
    () => availableGems.find((g) => g.id === gemId) ?? gems.find((g) => g.id === gemId) ?? null,
    [availableGems, gems, gemId],
  );

  async function handleSubmit() {
    if (!user) return;
    const next: Record<string, string> = {};
    if (!gemId) next.gemId = 'Select a gem.';
    if (!holderId) next.holderId = 'Select an AP holder.';
    if (!minPrice.trim()) next.minPrice = 'Enter a minimum price.';
    if (Object.keys(next).length) {
      setErrors(next);
      toast.error(Object.values(next)[0]);
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
      toast.error(friendlyError(e, 'Could not give on AP.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Give on AP" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSection title="Gem details">
          <GemSelectField
            label="Gem"
            gem={selectedGem}
            placeholder="Select a gem"
            onPress={() => setGemSheetOpen(true)}
            error={errors.gemId}
          />
          <Input
            label="Minimum Price (LKR)"
            value={minPrice}
            onChangeText={(v) => {
              setMinPrice(v);
              setErrors((e) => {
                if (!e.minPrice) return e;
                const next = { ...e };
                delete next.minPrice;
                return next;
              });
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="payments"
            error={errors.minPrice}
          />
          <Input
            label="Expected Days"
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
            leftIcon="schedule"
          />
        </FormSection>

        <FormSection title="AP holder">
          <ContactPicker
            label="AP Holder"
            contacts={contacts}
            value={holderId}
            onChange={(id) => {
              setHolderId(id);
              setErrors((e) => {
                if (!e.holderId) return e;
                const next = { ...e };
                delete next.holderId;
                return next;
              });
            }}
            typeFilter="broker"
            emptyHint="Add a broker or holder contact first."
            error={errors.holderId}
          />
        </FormSection>

        <ScreenInset>
          <Button title="Create AP Record" icon="handshake" loading={loading} onPress={handleSubmit} />
        </ScreenInset>
      </ThemedScrollView>

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={availableGems}
        value={gemId}
        title="Select gem for AP"
        emptyHint="No available gems. Add a gem or free one from another AP first."
        onSelect={(gem) => {
          setGemId(gem.id);
          setErrors((e) => {
            if (!e.gemId) return e;
            const next = { ...e };
            delete next.gemId;
            return next;
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.section },
});
