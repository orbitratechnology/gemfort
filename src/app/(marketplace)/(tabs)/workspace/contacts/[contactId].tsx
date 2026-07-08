import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { CONTACT_TYPES } from '@/constants/contact-types';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  deleteContact,
  fetchContactHistory,
  fetchContacts,
  updateContact,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDate, openPhone, openWhatsApp } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
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
    setContactTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSave() {
    if (!contact || !displayName.trim()) {
      toast.error('Contact name is required.');
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
      toast.success('Contact updated');
      setEditing(false);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save contact.'));
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
            toast.success('Contact deleted');
            router.back();
          } catch (e) {
            toast.error(friendlyError(e, 'Could not delete contact.'));
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <StackHeader title="Contact" />
        <Text style={[styles.loading, { color: colors.textMuted }]}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <StackHeader title="Contact" />
        <View style={styles.center}>
          <EmptyState title="Contact not found" subtitle="It may have been deleted." />
        </View>
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <StackHeader title="Edit Contact" closeIcon onBack={() => setEditing(false)} />
        <ThemedScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Input label="Name" value={displayName} onChangeText={setDisplayName} />
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>TYPES</Text>
            <View style={styles.typeChips}>
              {CONTACT_TYPES.map((t) => {
                const active = contactTypes.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => toggleType(t)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                    ]}>
                    <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
          </View>
          <Button title="Save Changes" loading={saving} onPress={handleSave} />
        </ThemedScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title="Contact"
        right={
          <Pressable onPress={startEdit} hitSlop={8}>
            <Icon name="edit" size={22} color={colors.primary} />
          </Pressable>
        }
      />
      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Identity */}
        <View style={[styles.identityCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(contact.displayName)}</Text>
          </View>
          <Text style={[styles.name, { color: colors.primary }]}>{contact.displayName}</Text>
          {contact.companyName ? (
            <Text style={[styles.company, { color: colors.textMuted }]}>{contact.companyName}</Text>
          ) : null}
          {contact.contactTypes.length ? (
            <View style={styles.typeRow}>
              {contact.contactTypes.map((t) => (
                <View key={t} style={[styles.typeBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.onSurfaceVariant }]}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Contact actions */}
        <View style={styles.actionRow}>
          {contact.whatsapp ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
              onPress={() => Linking.openURL(openWhatsApp(contact.whatsapp!))}>
              <Icon name="chat" size={18} color="#FFFFFF" />
              <Text style={[styles.actionText, { color: '#FFFFFF' }]}>WhatsApp</Text>
            </Pressable>
          ) : null}
          {contact.phone ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL(openPhone(contact.phone!))}>
              <Icon name="call" size={18} color={colors.onPrimary} />
              <Text style={[styles.actionText, { color: colors.onPrimary }]}>Call</Text>
            </Pressable>
          ) : null}
        </View>

        {contact.phone || contact.email ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            {contact.phone ? (
              <View style={styles.infoRow}>
                <Icon name="call" size={18} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.onSurface }]} selectable>{contact.phone}</Text>
              </View>
            ) : null}
            {contact.email ? (
              <View style={styles.infoRow}>
                <Icon name="mail-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.onSurface }]} selectable>{contact.email}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {contact.notes ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>{contact.notes}</Text>
          </View>
        ) : null}

        {/* History */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>Service History</Text>
        {history?.services.length ? (
          history.services.map((s) => (
            <View key={s.id} style={[styles.historyRow, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Icon name="handyman" size={18} color={colors.primary} />
              <View style={styles.historyBody}>
                <Text style={[styles.historyTitle, { color: colors.onSurface }]}>{s.serviceType.replace(/_/g, ' ')}</Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{s.status} · {formatDate(s.dateGiven)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyHistory, { color: colors.textMuted }]}>No services linked.</Text>
        )}

        <Text style={[styles.sectionTitle, { color: colors.primary }]}>AP History</Text>
        {history?.apRecords.length ? (
          history.apRecords.map((a) => (
            <View key={a.id} style={[styles.historyRow, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Icon name="hourglass-empty" size={18} color={colors.primary} />
              <View style={styles.historyBody}>
                <Text style={[styles.historyTitle, { color: colors.onSurface }]}>AP · {a.status}</Text>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{formatDate(a.dateGiven)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyHistory, { color: colors.textMuted }]}>No AP records linked.</Text>
        )}

        <Button title="Delete Contact" variant="ghost" onPress={handleDelete} textStyle={{ color: colors.error }} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  center: { flex: 1, padding: Spacing.containerMargin, justifyContent: 'center' },
  content: { padding: Spacing.containerMargin, gap: Spacing.md, paddingBottom: Spacing.section },

  identityCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { ...Typography.headlineSm, fontWeight: '700' },
  name: { ...Typography.headlineSm },
  company: { ...Typography.bodyMd },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: 'center' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  typeBadgeText: { ...Typography.labelMd, textTransform: 'capitalize' },

  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  actionText: { ...Typography.labelMd },

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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { ...Typography.bodyLg },
  notes: { ...Typography.bodyMd },

  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.5 },
  sectionTitle: { ...Typography.headlineSmMobile, marginTop: Spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  historyBody: { flex: 1 },
  historyTitle: { ...Typography.bodyLg, textTransform: 'capitalize' },
  historyMeta: { ...Typography.caption, marginTop: 2 },
  emptyHistory: { ...Typography.bodyMd },

  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { ...Typography.labelMd, textTransform: 'capitalize' },
});
