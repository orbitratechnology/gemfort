import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { CONTACT_TYPES } from '@/constants/contact-types';
import { Palette, Spacing, Typography } from '@/constants/design-tokens';
import {
  deleteContact,
  fetchContactHistory,
  fetchContacts,
  updateContact,
} from '@/features/workspace/workspace-service';
import { formatDate, openPhone, openWhatsApp } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [contactTypes, setContactTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ['contact-history', user?.uid, contactId],
    queryFn: () => fetchContactHistory(user!.uid, contactId!),
    enabled: !!user && !!contactId,
  });

  const contact = contacts.find((c) => c.id === contactId);

  function startEdit() {
    if (!contact) return;
    setDisplayName(contact.displayName);
    setPhone(contact.phone ?? '');
    setWhatsapp(contact.whatsapp ?? '');
    setEmail(contact.email ?? '');
    setContactTypes(contact.contactTypes);
    setNotes(contact.notes ?? '');
    setEditing(true);
  }

  function toggleType(t: string) {
    setContactTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function handleSave() {
    if (!contact || !displayName.trim()) {
      Alert.alert('Name required');
      return;
    }
    setSaving(true);
    try {
      await updateContact(contact.id, {
        displayName: displayName.trim(),
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        contactTypes,
        notes: notes || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!contact) return;
    Alert.alert('Delete contact?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(contact.id);
            await queryClient.invalidateQueries({ queryKey: ['contacts'] });
            router.back();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  }

  if (isLoading) return <Text style={styles.loading}>Loading...</Text>;
  if (!contact) {
    return (
      <View style={styles.center}>
        <EmptyState title="Contact not found" subtitle="It may have been deleted." />
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (editing) {
    return (
      <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Input label="Name" value={displayName} onChangeText={setDisplayName} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Text style={styles.label}>Types</Text>
        <View style={styles.typeChips}>
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
        <Button title="Save Changes" loading={saving} onPress={handleSave} />
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
      </ThemedScrollView>
    );
  }

  return (
    <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.name}>{contact.displayName}</Text>
        {contact.companyName ? <Text style={styles.meta}>{contact.companyName}</Text> : null}
        {contact.phone ? <Text style={styles.meta}>{contact.phone}</Text> : null}
        {contact.whatsapp ? <Text style={styles.meta}>WhatsApp: {contact.whatsapp}</Text> : null}
        {contact.email ? <Text style={styles.meta}>{contact.email}</Text> : null}
        <Text style={styles.types}>{contact.contactTypes.join(', ')}</Text>
        {contact.notes ? <Text style={styles.notes}>{contact.notes}</Text> : null}
      </Card>

      {contact.whatsapp ? (
        <Button
          title="WhatsApp"
          variant="whatsapp"
          onPress={() => Linking.openURL(openWhatsApp(contact.whatsapp!))}
        />
      ) : null}
      {contact.phone ? (
        <Button title="Call" variant="phone" onPress={() => Linking.openURL(openPhone(contact.phone!))} />
      ) : null}

      <View style={styles.actions}>
        <Button title="Edit" variant="secondary" onPress={startEdit} />
        <Button title="Delete" variant="ghost" onPress={handleDelete} />
      </View>

      <Text style={styles.sectionTitle}>Service history</Text>
      {history?.services.length ? (
        history.services.map((s) => (
          <Card key={s.id} style={styles.historyRow}>
            <Text style={styles.historyTitle}>{s.serviceType.replace(/_/g, ' ')}</Text>
            <Text style={styles.historyMeta}>
              {s.status} · Given {formatDate(s.dateGiven)}
            </Text>
          </Card>
        ))
      ) : (
        <Text style={styles.emptyHistory}>No services linked to this contact.</Text>
      )}

      <Text style={styles.sectionTitle}>AP history</Text>
      {history?.apRecords.length ? (
        history.apRecords.map((a) => (
          <Card key={a.id} style={styles.historyRow}>
            <Text style={styles.historyTitle}>AP · {a.status}</Text>
            <Text style={styles.historyMeta}>Given {formatDate(a.dateGiven)}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.emptyHistory}>No AP records linked to this contact.</Text>
      )}
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: 'center' },
  loading: { padding: Spacing.lg },
  name: { ...Typography.h2, color: Palette.gemBlue },
  meta: { ...Typography.body, color: Palette.gray700 },
  types: { ...Typography.caption, color: Palette.gemGold, marginTop: Spacing.sm, textTransform: 'capitalize' },
  notes: { ...Typography.body, color: Palette.gray500, marginTop: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  sectionTitle: { ...Typography.h3, color: Palette.gray900, marginTop: Spacing.sm },
  historyRow: { marginBottom: Spacing.xs },
  historyTitle: { ...Typography.body, color: Palette.gray900, textTransform: 'capitalize' },
  historyMeta: { ...Typography.caption, color: Palette.gray500 },
  emptyHistory: { ...Typography.body, color: Palette.gray500 },
  label: { ...Typography.label, color: Palette.gray700 },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.gray300,
  },
  chipActive: { backgroundColor: Palette.gemBlue, borderColor: Palette.gemBlue },
  chipText: { ...Typography.bodySmall, color: Palette.gray700, textTransform: 'capitalize' },
  chipTextActive: { color: Palette.white },
});
