import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Palette, Spacing } from '@/constants/design-tokens';
import { createApRecord, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAuth } from '@/providers/auth-provider';

export default function AddApScreen() {
  const { user } = useAuth();
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

  const availableGems = gems.filter(
    (g) => !['on_ap', 'sold'].includes(g.status),
  );

  async function handleSubmit() {
    if (!user || !gemId || !holderId || !minPrice) {
      Alert.alert('Missing fields');
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
      router.replace(`/(marketplace)/(tabs)/workspace/ap/${id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Select gem:</Text>
      {availableGems.map((g) => (
        <Button
          key={g.id}
          title={`${g.sku} — ${g.currentWeight}ct`}
          variant={gemId === g.id ? 'primary' : 'secondary'}
          onPress={() => setGemId(g.id)}
        />
      ))}
      <Input label="Minimum Price (LKR)" value={minPrice} onChangeText={setMinPrice} keyboardType="decimal-pad" />
      <Input label="Expected Days" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <ContactPicker
        label="AP Holder"
        contacts={contacts}
        value={holderId}
        onChange={setHolderId}
        typeFilter="broker"
        emptyHint="Add a broker or holder contact first."
      />
      <Button title="Create AP Record" loading={loading} onPress={handleSubmit} />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.white },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  label: { color: Palette.gray700, marginTop: Spacing.sm },
});
