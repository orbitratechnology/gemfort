import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createCheque, fetchContacts } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Timestamp } from '@/lib/firebase/db';
import { uploadPickedImage } from '@/lib/firebase/storage-service';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { ChequeDirection } from '@/types';

const DIRECTIONS: { id: ChequeDirection; label: string; subtitle: string }[] = [
  { id: 'received', label: 'Received', subtitle: 'Payment coming to you' },
  { id: 'given', label: 'Given', subtitle: 'Cheque you issued' },
];

export default function AddChequeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    amount?: string;
    gemId?: string;
    apRecordId?: string;
    contactId?: string;
  }>();

  const [direction, setDirection] = useState<ChequeDirection>('received');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [contactId, setContactId] = useState(params.contactId ?? '');
  const [issuedBy, setIssuedBy] = useState('');
  const [maturityDays, setMaturityDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );

  async function handleUploadPhoto() {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadPickedImage(`cheques/${user.uid}/${Date.now()}.jpg`);
      if (url) {
        setPhotoUrl(url);
        toast.success('Cheque photo added.');
      }
    } catch (e) {
      toast.error(friendlyError(e, 'Could not upload photo.'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!user) return;
    if (!chequeNumber.trim() || !bankName.trim() || !amount || !contactId) {
      toast.error('Fill in cheque number, bank, amount, and contact.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const now = Timestamp.now();
      const maturity = Timestamp.fromDate(addDays(new Date(), parseInt(maturityDays, 10) || 30));
      const issuer = issuedBy.trim() || selectedContact?.displayName || 'Unknown';

      const id = await createCheque(user.uid, {
        direction,
        chequeNumber,
        bankName,
        branch: branch || null,
        amount: parsedAmount,
        counterpartyContactId: contactId,
        issuedBy: issuer,
        issueDate: now,
        maturityDate: maturity,
        photoUrl,
        gemId: params.gemId ?? null,
        apRecordId: params.apRecordId ?? null,
        notes: notes || null,
      });

      await queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast.success('Cheque added to your tracker.');
      router.replace(`/(marketplace)/(tabs)/workspace/cheques/${id}` as never);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save cheque.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Cheque" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Record a post-dated cheque and track its maturity date.
        </Text>

        {/* Direction */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>DIRECTION</Text>
          <View style={styles.directionRow}>
            {DIRECTIONS.map((d) => {
              const active = direction === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setDirection(d.id)}
                  style={[
                    styles.directionCard,
                    {
                      backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLowest,
                      borderColor: active ? colors.primary : colors.outlineVariant,
                    },
                  ]}>
                  <Icon
                    name={d.id === 'received' ? 'call-received' : 'call-made'}
                    size={22}
                    color={active ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                  />
                  <Text style={[styles.directionLabel, { color: active ? colors.onPrimaryContainer : colors.onSurface }]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.directionSub, { color: colors.textMuted }]}>{d.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Cheque number" value={chequeNumber} onChangeText={setChequeNumber} placeholder="e.g. 001234" />
          <Input label="Bank" value={bankName} onChangeText={setBankName} placeholder="Commercial Bank" />
          <Input label="Branch (optional)" value={branch} onChangeText={setBranch} placeholder="Beruwala" />
          <Input
            label="Amount (LKR)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <Input
            label="Maturity in days"
            value={maturityDays}
            onChangeText={setMaturityDays}
            keyboardType="number-pad"
            placeholder="30"
          />
          {maturityDays ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Matures {format(addDays(new Date(), parseInt(maturityDays, 10) || 30), 'd MMM yyyy')}
            </Text>
          ) : null}
        </View>

        {/* Contact */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <ContactPicker
            label="Counterparty"
            contacts={contacts}
            value={contactId}
            onChange={(id) => {
              setContactId(id);
              const c = contacts.find((x) => x.id === id);
              if (c && !issuedBy) setIssuedBy(c.displayName);
            }}
          />
          <Input
            label="Issued by (display name)"
            value={issuedBy}
            onChangeText={setIssuedBy}
            placeholder={selectedContact?.displayName ?? 'Name on cheque'}
          />
        </View>

        {/* Photo */}
        <Pressable
          onPress={handleUploadPhoto}
          disabled={uploading}
          style={({ pressed }) => [
            styles.photoCard,
            { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            pressed && { opacity: 0.85 },
          ]}>
          <Icon name={photoUrl ? 'check-circle' : 'photo-camera'} size={24} color={colors.primary} />
          <View style={styles.photoText}>
            <Text style={[styles.photoTitle, { color: colors.onSurface }]}>
              {photoUrl ? 'Photo attached' : 'Add cheque photo'}
            </Text>
            <Text style={[styles.photoSub, { color: colors.textMuted }]}>
              {uploading ? 'Uploading…' : 'Optional — capture or pick from gallery'}
            </Text>
          </View>
        </Pressable>

        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline style={styles.notes} />

        <Button title="Save cheque" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  subtitle: { ...Typography.bodySmall, lineHeight: 20 },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 1 },
  directionRow: { flexDirection: 'row', gap: Spacing.md },
  directionCard: {
    flex: 1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  directionLabel: { ...Typography.labelMd, fontWeight: '600' },
  directionSub: { ...Typography.bodySmall, lineHeight: 18 },
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  hint: { ...Typography.bodySmall, marginTop: -4 },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  photoText: { flex: 1, gap: 2 },
  photoTitle: { ...Typography.labelMd, fontWeight: '600' },
  photoSub: { ...Typography.bodySmall },
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
