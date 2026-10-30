import { addDays } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoicePreviewCard, ChoiceTileGrid } from '@/components/ui/choice-tile-grid';
import { CityField } from '@/components/ui/city-field';
import { CountryField } from '@/components/ui/country-field';
import {
    CurrencyAmountField,
    type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { ThemedScrollView } from '@/components/ui/screen';
import { SheetFooter } from '@/components/ui/sheet-footer';
import { StackHeader } from '@/components/ui/stack-header';
import { CalendarSyncToggle } from '@/components/workspace/calendar-sync-toggle';
import {
    isTripDocumentKind,
    TRIP_DOCUMENT_KINDS,
    TripDocumentThumb,
    tripDocumentKindLabel,
} from '@/components/workspace/trip-documents';
import { cityBelongsToCountry } from '@/constants/cities';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { TRIP_TYPES } from '@/constants/trip-options';
import {
    createTrip,
    TripDocumentsUploadError,
} from '@/features/workspace/workspace-service';
import { commitmentDeepLink } from '@/features/calendar-sync/links';
import { makeSyncCommitment } from '@/features/calendar-sync/commitments';
import { writeCommitmentToDevice } from '@/features/calendar-sync/sync-item';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { friendlyError } from '@/lib/errors';
import { Timestamp } from '@/lib/firebase/db';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import { scanDocuments } from '@/lib/scan';
import { addTripSchema, parseForm } from '@/lib/validation/form-schemas';
import { replaceWithAnchor } from '@/navigation/tab-stack-nav';
import { useAuth } from '@/providers/auth-provider';
import { showActions } from '@/providers/confirm-bridge';
import { useToast } from '@/providers/toast-provider';
import type { TripDocumentKind, TripType } from '@/types';

type PendingTripDocument = { key: string; kind: TripDocumentKind; media: LocalMedia };

let pendingDocSeq = 0;
function nextPendingKey(): string {
  pendingDocSeq += 1;
  return `scan-${pendingDocSeq}`;
}

/** `scanUris` is a JSON string array of local file URIs from the scanner. */
function parseScanUris(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === 'string' && u.length > 0)
      : [];
  } catch {
    return [];
  }
}

function pendingFromUri(uri: string, index: number, kind: TripDocumentKind): PendingTripDocument {
  return {
    key: nextPendingKey(),
    kind,
    media: { uri, kind: 'image', mimeType: 'image/webp', fileName: `scan-${index + 1}.webp` },
  };
}

export default function AddTripScreen() {
  const params = useLocalSearchParams<{ scanUris?: string; scanKind?: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [destinationCountry, setDestinationCountry] = useState('Sri Lanka');
  const [destinationCity, setDestinationCity] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [budget, setBudget] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const defaultDocKind: TripDocumentKind = isTripDocumentKind(params.scanKind)
    ? params.scanKind
    : 'other';
  const [documents, setDocuments] = useState<PendingTripDocument[]>(() =>
    parseScanUris(params.scanUris).map((uri, i) => pendingFromUri(uri, i, defaultDocKind)),
  );

  const typeMeta = TRIP_TYPES.find((t) => t.id === tripType);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSelectType(next: TripType) {
    setTripType(next);
    clearField('tripType');
    setStep(1);
  }

  const [scanning, handleScan] = usePendingAction(async () => {
    try {
      const pages = await scanDocuments({ maxPages: 4 });
      if (!pages.length) return;
      setDocuments((prev) => [
        ...prev,
        ...pages.map((media) => ({ key: nextPendingKey(), kind: defaultDocKind, media })),
      ]);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not scan document.'));
    }
  });

  function handleChangeDocKind(key: string) {
    showActions({
      title: 'Document type',
      actions: TRIP_DOCUMENT_KINDS.map((k) => ({
        label: k.label,
        onPress: () =>
          setDocuments((prev) => prev.map((d) => (d.key === key ? { ...d, kind: k.value } : d))),
      })),
    });
  }

  function handleRemoveDoc(key: string) {
    setDocuments((prev) => prev.filter((d) => d.key !== key));
  }

  const [submitting, handleSubmit] = usePendingAction(async () => {
    if (!user) {
      toast.error('Sign in to create a trip.');
      return;
    }
    if (!tripType) {
      toast.error('Select a trip type.');
      setStep(0);
      return;
    }
    const result = parseForm(addTripSchema, {
      tripName,
      tripType,
      destinationCity,
      destinationCountry,
      durationDays,
      budget: budget.amount,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return;
    }

    try {
      const data = result.data;
      const startDate = new Date();
      const endDate = addDays(startDate, data.durationDays);
      const start = Timestamp.fromDate(startDate);
      const end = Timestamp.fromDate(endDate);
      const id = await createTrip(user.uid, {
        tripName: data.tripName,
        tripType: data.tripType,
        destinationCountry: data.destinationCountry,
        destinationCity: data.destinationCity,
        startDate: start,
        expectedEndDate: end,
        budget: data.budget ?? 0,
        budgetCurrency: budget.currency,
        cashCarried: 0,
        cashCarriedCurrency: budget.currency,
        notes: data.notes || null,
        documents: documents.map(({ kind, media }) => ({ kind, media })),
      });
      if (calendarSyncEnabled) {
        const commitment = makeSyncCommitment({
          surface: "calendar",
          sourceType: "trip",
          sourceId: id,
          title: `Trip: ${data.tripName}`,
          date: startDate,
          endDate,
          url: commitmentDeepLink("trip", id),
        });
        if ((await writeCommitmentToDevice(commitment)) === false) {
          toast.info("Trip saved, but its calendar entry could not be added.");
        }
      }
      toast.success('Trip created.');
      replaceWithAnchor(`/(marketplace)/(tabs)/workspace/trips/${id}` as never);
    } catch (e) {
      if (e instanceof TripDocumentsUploadError) {
        // The trip exists; open it so the user can rescan from there.
        toast.error('Trip created, but some documents did not upload. Scan them again from the trip.');
        replaceWithAnchor(`/(marketplace)/(tabs)/workspace/trips/${e.tripId}` as never);
        return;
      }
      toast.error(friendlyError(e, 'Could not create trip.'));
    }
  });

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title={step === 0 ? 'Trip type' : 'Plan trip'}
        closeIcon
        image={require('@/assets/images/trips-icon.png')}
      />

      {step === 0 ? (
        <View
          style={[
            styles.typeStep,
            { paddingBottom: Math.max(insets.bottom, Spacing.xl) },
          ]}
        >
          <ChoiceTileGrid
            layout="grid"
            options={TRIP_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              span: t.id === 'both' ? 2 : 1,
            }))}
            value={tripType}
            onChange={handleSelectType}
            error={errors.tripType}
          />
        </View>
      ) : (
        <>
          <ThemedScrollView
            style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {typeMeta ? (
              <ChoicePreviewCard
                label={typeMeta.label}
                icon={typeMeta.icon}
                onPress={() => setStep(0)}
              />
            ) : null}

            <FormSection title="Trip">
              <Input
                label="Trip name"
                value={tripName}
                onChangeText={(v) => {
                  setTripName(v);
                  clearField('tripName');
                }}
                placeholder="e.g. China, Bangkok, Madagascar..."
                leftIcon="trip"
                error={errors.tripName}
              />
              <MaskedInput
                label="Duration (days)"
                mode="custom"
                mask="999"
                value={durationDays}
                onChangeText={(v) => {
                  setDurationDays(v);
                  clearField('durationDays');
                }}
                keyboardType="number-pad"
                leftIcon="schedule"
                error={errors.durationDays}
              />
            </FormSection>

            <FormSection title="Destination">
              <CountryField
                label="Country"
                value={destinationCountry}
                onChange={(name) => {
                  setDestinationCountry(name);
                  clearField('destinationCountry');
                  if (!destinationCity) return;
                  void cityBelongsToCountry(destinationCity, name).then((ok) => {
                    if (!ok) {
                      setDestinationCity('');
                      clearField('destinationCity');
                    }
                  });
                }}
                placeholder="Select country"
                error={errors.destinationCountry}
              />
              <CityField
                label="Destination city"
                value={destinationCity}
                country={destinationCountry}
                onChange={(name) => {
                  setDestinationCity(name);
                  clearField('destinationCity');
                }}
                placeholder="Select city"
                sheetTitle="Destination city"
                error={errors.destinationCity}
              />
            </FormSection>

            <FormSection title="Budget & notes">
              <CurrencyAmountField
                label="Total budget"
                value={budget}
                onChange={(next) => {
                  setBudget(next);
                  clearField('budget');
                }}
                error={errors.budget}
              />
              <Input
                label="Notes"
                value={notes}
                onChangeText={(v) => {
                  setNotes(v);
                  clearField('notes');
                }}
                multiline
                style={styles.notes}
                placeholder="Optional"
                leftIcon="notes"
                error={errors.notes}
              />
            </FormSection>

            <FormSection
              title="Travel documents"
              hint="Visas and tickets stay private to you.">
              {documents.map((d) => {
                const label = tripDocumentKindLabel(d.kind);
                return (
                  <View key={d.key} style={styles.docRow}>
                    <TripDocumentThumb uri={d.media.uri} size={48} />
                    <Pressable
                      onPress={() => handleChangeDocKind(d.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${label}. Change document type`}
                      style={({ pressed }) => [styles.docText, pressed && { opacity: 0.7 }]}>
                      <Text style={[styles.docTitle, { color: colors.onSurface }]}>{label}</Text>
                      <Text style={[styles.docSub, { color: colors.textMuted }]}>
                        Tap to change type
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemoveDoc(d.key)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${label}`}
                      style={({ pressed }) => [styles.docIconBtn, pressed && { opacity: 0.6 }]}>
                      <Icon name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable
                onPress={() => void handleScan()}
                disabled={scanning || submitting}
                accessibilityRole="button"
                accessibilityLabel="Scan document"
                style={({ pressed }) => [
                  styles.scanBtn,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                    opacity: scanning || submitting ? 0.55 : pressed ? 0.85 : 1,
                  },
                ]}>
                <Icon name="document-scanner" size={22} color={colors.primary} />
                <Text style={[styles.scanText, { color: colors.onSurface }]}>
                  {documents.length ? 'Scan another document' : 'Scan document'}
                </Text>
              </Pressable>
            </FormSection>

            <FormSection>
              <CalendarSyncToggle
                surface="calendar"
                value={calendarSyncEnabled}
                onValueChange={setCalendarSyncEnabled}
                colors={colors}
              />
            </FormSection>
          </ThemedScrollView>

          <SheetFooter>
            <FormFooter
              title="Create trip"
              icon="add"
              loading={submitting}
              onPress={handleSubmit}
              secondaryTitle="Back"
              onSecondaryPress={() => setStep(0)}
            />
          </SheetFooter>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  typeStep: {
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.md,
  },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  docText: { flex: 1, minWidth: 0, gap: 2 },
  docTitle: { fontFamily: FontFamily.medium, fontSize: 15, includeFontPadding: false },
  docSub: { fontFamily: FontFamily.regular, fontSize: 13, includeFontPadding: false },
  docIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  scanText: { fontFamily: FontFamily.medium, fontSize: 15, includeFontPadding: false },
});
