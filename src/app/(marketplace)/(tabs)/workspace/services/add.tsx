import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Palette, Spacing } from '@/constants/design-tokens';
import { createService, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAuth } from '@/providers/auth-provider';

export default function AddServiceScreen() {
  const { user } = useAuth();
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
      Alert.alert('Missing fields', 'Select gem and provider');
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
      router.replace(`/(marketplace)/(tabs)/workspace/services/${id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>Gem ID: {gemId || 'select below'}</Text>
      {gems.slice(0, 5).map((g) => (
        <Button
          key={g.id}
          title={`${g.sku} — ${g.gemType}`}
          variant={gemId === g.id ? 'primary' : 'secondary'}
          onPress={() => {
            setGemId(g.id);
            setWeightBefore(String(g.currentWeight));
          }}
        />
      ))}
      <Input label="Service Type" value={serviceType} onChangeText={setServiceType} />
      <Input label="Weight Before (ct)" value={weightBefore} onChangeText={setWeightBefore} keyboardType="decimal-pad" />
      <Input label="Days Until Return" value={daysUntilReturn} onChangeText={setDaysUntilReturn} keyboardType="number-pad" />
      <ContactPicker
        label="Provider contact"
        contacts={contacts}
        value={providerContactId}
        onChange={setProviderContactId}
        typeFilter="cutter"
        emptyHint="Add a cutter or provider contact first."
      />
      <Button title="Create Service Record" loading={loading} onPress={handleSubmit} />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.white },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  hint: { color: Palette.gray500, marginVertical: 4 },
});
