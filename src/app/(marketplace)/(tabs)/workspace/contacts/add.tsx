import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { PhoneNumberField } from '@/components/ui/phone-number-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactAvatar } from '@/components/workspace/contact-avatar';
import { CONTACT_TYPES } from '@/constants/contact-types';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { presentDeviceContactPicker } from '@/features/workspace/device-contacts-service';
import {
  createContact,
  importDeviceContactToWorkspace,
  updateContact,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

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
  const [deviceContactId, setDeviceContactId] = useState<string | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);

  function toggleType(t: string) {
    setContactTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handlePickFromPhone() {
    if (!user) return;
    setPicking(true);
    try {
      const device = await presentDeviceContactPicker();
      if (!device) return;

      // Fast path: import straight into workspace and open detail
      const { id } = await importDeviceContactToWorkspace(user.uid, device, {
        contactTypes,
      });
      toast.success('Contact imported from phone.');
      router.replace(`/(marketplace)/(tabs)/workspace/contacts/${id}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not pick a phone contact.'));
    } finally {
      setPicking(false);
    }
  }

  async function handlePrefillFromPhone() {
    setPicking(true);
    try {
      const device = await presentDeviceContactPicker();
      if (!device) return;
      setDisplayName(device.displayName);
      setCompanyName(device.companyName ?? '');
      setPhone(device.phone ?? '');
      setWhatsapp(device.phone ?? '');
      setEmail(device.email ?? '');
      setDeviceContactId(device.id);
      setLocalPhotoUri(device.imageUri);
      toast.success('Filled from phone contact.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not pick a phone contact.'));
    } finally {
      setPicking(false);
    }
  }

  async function handleSubmit() {
    if (!user || !displayName.trim()) {
      toast.error('Contact name is required.');
      return;
    }
    setLoading(true);
    try {
      if (deviceContactId) {
        const { id } = await importDeviceContactToWorkspace(
          user.uid,
          {
            id: deviceContactId,
            displayName: displayName.trim(),
            companyName: companyName || null,
            phone: phone || null,
            email: email || null,
            imageUri: localPhotoUri,
          },
          { contactTypes },
        );
        // Apply edited fields that import may not have overridden (whatsapp/notes/types)
        await updateContact(id, {
          whatsapp: whatsapp || phone || null,
          notes: notes || null,
          contactTypes,
          companyName: companyName || null,
        });
        toast.success('Contact saved');
        router.replace(`/(marketplace)/(tabs)/workspace/contacts/${id}`);
        return;
      }

      const id = await createContact(user.uid, {
        displayName: displayName.trim(),
        companyName: companyName || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        contactTypes,
        notes: notes || null,
        isFavourite: false,
        photoUrl: null,
        deviceContactId: null,
        linkedBusinessId: null,
        linkedBusinessName: null,
        linkedBusinessType: null,
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
        <ScreenInset style={styles.lead}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void handlePickFromPhone()}
          disabled={picking}
          style={({ pressed }) => [
            styles.phoneCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              opacity: picking ? 0.7 : pressed ? 0.92 : 1,
            },
          ]}>
          <View style={[styles.phoneIcon, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="contacts" size={22} color={colors.onPrimaryContainer} />
          </View>
          <View style={styles.phoneBody}>
            <Text style={[styles.phoneTitle, { color: colors.onSurface }]}>Pick from phone</Text>
            <Text style={[styles.phoneSub, { color: colors.textMuted }]}>
              Uses the system contact picker · includes photo
            </Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
        </Pressable>

        <Pressable onPress={() => void handlePrefillFromPhone()} disabled={picking}>
          <Text style={[styles.prefillLink, { color: colors.primary }]}>
            Or fill this form from a phone contact
          </Text>
        </Pressable>

        {(localPhotoUri || displayName) && (
          <View style={styles.previewRow}>
            <ContactAvatar
              name={displayName || 'Contact'}
              photoUrl={localPhotoUri}
              size={56}
            />
            {deviceContactId ? (
              <Text style={[styles.linked, { color: colors.textMuted }]}>Linked to phone contact</Text>
            ) : null}
          </View>
        )}
        </ScreenInset>

        <FormSection title="Contact">
          <Input label="Name" value={displayName} onChangeText={setDisplayName} placeholder="Full name" leftIcon="person" />
          <Input label="Company" value={companyName} onChangeText={setCompanyName} placeholder="Optional" leftIcon="business" />
          <PhoneNumberField label="Phone" value={phone} onChangeText={setPhone} />
          <PhoneNumberField label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} />
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" leftIcon="email" />
        </FormSection>

        <FormSection title="Contact types" padded={false}>
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
                      : {
                          backgroundColor: colors.surfaceContainerLowest,
                          borderColor: colors.outlineVariant,
                        },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Notes">
          <Input label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional notes" leftIcon="notes" />
        </FormSection>

        <ScreenInset>
          <Button title="Save Contact" icon="person-add" loading={loading} onPress={handleSubmit} />
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.section },
  lead: { gap: Spacing.lg },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 64,
  },
  phoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBody: { flex: 1, minWidth: 0, gap: 2 },
  phoneTitle: { ...Typography.labelMd, fontWeight: '700' },
  phoneSub: { ...Typography.caption },
  prefillLink: { ...Typography.labelMd, fontWeight: '600', textAlign: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linked: { ...Typography.caption },
  types: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { ...Typography.labelMd, textTransform: 'capitalize' },
});
