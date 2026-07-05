import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Palette, Spacing, Typography } from '@/constants/design-tokens';
import { createContact } from '@/features/workspace/workspace-service';
import { useAuth } from '@/providers/auth-provider';

import { CONTACT_TYPES } from '@/constants/contact-types';

export default function AddContactScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [contactTypes, setContactTypes] = useState<string[]>(['broker']);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleType(t: string) {
    setContactTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function handleSubmit() {
    if (!user || !displayName) {
      Alert.alert('Name required');
      return;
    }
    setLoading(true);
    try {
      const id = await createContact(user.uid, {
        displayName,
        companyName: null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        contactTypes,
        notes: notes || null,
        isFavourite: false,
      });
      router.replace(`/(marketplace)/(tabs)/workspace/contacts/${id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Name" value={displayName} onChangeText={setDisplayName} />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Text style={styles.label}>Types</Text>
      <View style={styles.types}>
        {CONTACT_TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, contactTypes.includes(t) && styles.chipActive]}
            onPress={() => toggleType(t)}>
            <Text style={[styles.chipText, contactTypes.includes(t) && styles.chipTextActive]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Button title="Save Contact" loading={loading} onPress={handleSubmit} />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.white },
  content: { padding: Spacing.lg, gap: Spacing.md },
  label: { ...Typography.label, color: Palette.gray700 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Palette.gray300 },
  chipActive: { backgroundColor: Palette.gemBlue, borderColor: Palette.gemBlue },
  chipText: { ...Typography.bodySmall, color: Palette.gray700, textTransform: 'capitalize' },
  chipTextActive: { color: Palette.white },
});
