import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createContact } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

import { CONTACT_TYPES } from '@/constants/contact-types';

export default function AddContactScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [contactTypes, setContactTypes] = useState<string[]>(['broker']);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleType(t: string) {
    setContactTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSubmit() {
    if (!user || !displayName) {
      toast.error('Contact name is required.');
      return;
    }
    setLoading(true);
    try {
      const id = await createContact(user.uid, {
        displayName,
        companyName: companyName || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        contactTypes,
        notes: notes || null,
        isFavourite: false,
      });
      toast.success('Contact added');
      router.replace(`/(marketplace)/(tabs)/workspace/contacts/${id}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add contact.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Contact" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Name" value={displayName} onChangeText={setDisplayName} placeholder="Full name" leftIcon="person" />
          <Input label="Company" value={companyName} onChangeText={setCompanyName} placeholder="Optional" leftIcon="business" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="phone" />
          <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" leftIcon="chat" />
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" leftIcon="email" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>CONTACT TYPES</Text>
          <View style={styles.types}>
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
                  <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional notes" leftIcon="notes" />
        </View>

        <Button title="Save Contact" icon="person-add" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.lg, paddingBottom: Spacing.section },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.5 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { ...Typography.labelMd, textTransform: 'capitalize' },
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
