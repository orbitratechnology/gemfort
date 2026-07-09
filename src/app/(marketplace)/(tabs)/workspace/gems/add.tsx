import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ChipSelect } from '@/components/ui/chip-select';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { GEM_TYPES, formatGemType } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createGem } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from '@/lib/firebase/storage-service';
import { formatCurrency } from '@/lib/utils';
import { addGemSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

const TREATMENTS = [
  { value: 'none' as const, label: 'None', icon: 'block' as const },
  { value: 'heat' as const, label: 'Heat', icon: 'local-fire-department' as const },
  { value: 'oil' as const, label: 'Oil', icon: 'water-drop' as const },
  { value: 'irradiation' as const, label: 'Irradiation', icon: 'science' as const },
];

const STEPS = ['Details', 'Photo', 'Review'] as const;

export default function AddGemScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [gemType, setGemType] = useState('blue_sapphire');
  const [typeOpen, setTypeOpen] = useState(false);
  const [originCountry, setOriginCountry] = useState('');
  const [roughWeight, setRoughWeight] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [treatment, setTreatment] = useState<'none' | 'heat' | 'oil' | 'irradiation'>('none');
  const [photo, setPhoto] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedType = useMemo(
    () => GEM_TYPES.find((t) => t.value === gemType) ?? GEM_TYPES[0],
    [gemType],
  );

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateDetails() {
    const result = parseForm(addGemSchema, {
      gemType,
      originCountry,
      roughWeight,
      acquisitionCost,
      treatment,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return null;
    }
    setErrors({});
    return result.data;
  }

  function handleNext() {
    if (step === 0) {
      if (!validateDetails()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    void handleSubmit();
  }

  async function handleSubmit() {
    if (!user) return;
    const data = validateDetails();
    if (!data) {
      setStep(0);
      return;
    }
    setLoading(true);
    try {
      let photoUrls: string[] = [];
      if (photo) {
        const ext = extensionForMedia(photo);
        const url = await uploadLocalMedia(
          photo,
          `gemtrack_gems/${user.uid}/${Date.now()}.${ext}`,
        );
        photoUrls = [url];
      }
      const gemId = await createGem(user.uid, {
        gemType: data.gemType,
        originCountry: data.originCountry,
        roughWeight: data.roughWeight,
        acquisitionCost: data.acquisitionCost,
        colorPrimary: null,
        notes: `Treatment: ${data.treatment}`,
        photoUrls,
      });
      toast.success('Gem added to your inventory');
      router.replace(`/(marketplace)/(tabs)/workspace/gems/${gemId}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add gem.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add gem" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.stepRow}>
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <View key={label} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        active || done ? colors.primary : colors.surfaceContainerHigh,
                    },
                  ]}>
                  {done ? (
                    <Icon name="check" size={14} color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={[
                        styles.stepNum,
                        { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                      ]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: active || done ? colors.primary : colors.textMuted },
                  ]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {step === 0 ? (
          <>
            <FormSection title="Stone" hint="Type, weight, and what you paid.">
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Gem type</Text>
                <Pressable
                  onPress={() => setTypeOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Gem type ${selectedType.label}. Tap to change`}
                  accessibilityHint="Opens gem type picker"
                  style={({ pressed }) => [
                    styles.typeField,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: errors.gemType ? colors.error : colors.outlineVariant,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    },
                  ]}>
                  <View style={[styles.typeFieldIcon, { backgroundColor: colors.primaryContainer }]}>
                    <Icon name={selectedType.icon} size={20} color={colors.onPrimaryContainer} />
                  </View>
                  <Text style={[styles.typeFieldValue, { color: colors.onSurface }]} numberOfLines={1}>
                    {selectedType.label}
                  </Text>
                  <Icon name="expand-more" size={22} color={colors.onSurfaceVariant} />
                </Pressable>
                {errors.gemType ? (
                  <Text style={[styles.fieldError, { color: colors.error }]} accessibilityLiveRegion="polite">
                    {errors.gemType}
                  </Text>
                ) : null}
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input
                    label="Weight (ct)"
                    value={roughWeight}
                    onChangeText={(v) => {
                      setRoughWeight(v);
                      clearField('roughWeight');
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leftIcon="scale"
                    error={errors.roughWeight}
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Purchase price"
                    value={acquisitionCost}
                    onChangeText={(v) => {
                      setAcquisitionCost(v);
                      clearField('acquisitionCost');
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leftIcon="payments"
                    error={errors.acquisitionCost}
                  />
                </View>
              </View>
              <Input
                label="Origin"
                value={originCountry}
                onChangeText={(v) => {
                  setOriginCountry(v);
                  clearField('originCountry');
                }}
                placeholder="e.g. Sri Lanka, Colombia"
                leftIcon="public"
                error={errors.originCountry}
              />
            </FormSection>

            <FormSection title="Treatment">
              <ChipSelect
                options={TREATMENTS}
                value={treatment}
                onChange={(v) => {
                  setTreatment(v);
                  clearField('treatment');
                }}
                error={errors.treatment}
              />
            </FormSection>
          </>
        ) : null}

        {step === 1 ? (
          <FormSection title="Photo" hint="Optional. Helps you recognise the stone later.">
            <MediaField
              value={photo}
              onChange={setPhoto}
              emptyTitle="Add photo"
              emptySubtitle="Kept on device until you save"
            />
          </FormSection>
        ) : null}

        {step === 2 ? (
          <FormSection title="Review">
            <View style={styles.reviewList}>
              <ReviewRow label="Type" value={formatGemType(gemType)} />
              <ReviewRow label="Weight" value={`${roughWeight} ct`} />
              <ReviewRow
                label="Price"
                value={formatCurrency(parseFloat(acquisitionCost) || 0)}
              />
              <ReviewRow label="Origin" value={originCountry.trim() || '-'} />
              <ReviewRow
                label="Treatment"
                value={treatment.charAt(0).toUpperCase() + treatment.slice(1)}
              />
              <ReviewRow label="Photo" value={photo ? 'Selected' : 'None'} />
            </View>
          </FormSection>
        ) : null}
      </ThemedScrollView>

      <FormFooter
        title={step === 2 ? 'Save gem' : 'Continue'}
        icon={step === 2 ? 'save' : 'arrow-forward'}
        loading={loading}
        onPress={handleNext}
        secondaryTitle={step > 0 ? 'Back' : undefined}
        onSecondaryPress={step > 0 ? () => setStep((s) => s - 1) : undefined}
      />

      <BottomSheet visible={typeOpen} onClose={() => setTypeOpen(false)} title="Gem type">
        <Text style={[styles.sheetHint, { color: colors.textMuted }]}>
          Choose the stone type for this inventory record.
        </Text>
        <View style={styles.typeList}>
          {GEM_TYPES.map((opt) => {
            const active = gemType === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.label}
                onPress={() => {
                  setGemType(opt.value);
                  clearField('gemType');
                  setTypeOpen(false);
                }}
                style={({ pressed }) => [
                  styles.typeOption,
                  {
                    backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow,
                    borderColor: active ? colors.primary : colors.outlineVariant,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}>
                <View
                  style={[
                    styles.typeOptionIcon,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceContainerHighest,
                    },
                  ]}>
                  <Icon
                    name={opt.icon}
                    size={18}
                    color={active ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                </View>
                <Text
                  style={[
                    styles.typeOptionLabel,
                    { color: active ? colors.onPrimaryContainer : colors.onSurface },
                  ]}>
                  {opt.label}
                </Text>
                {active ? <Icon name="check" size={20} color={colors.primary} /> : <View style={styles.typeOptionSpacer} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.reviewRow, { borderBottomColor: colors.outlineVariant }]}>
      <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: colors.onSurface }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { ...Typography.caption, fontWeight: '700' },
  stepLabel: { ...Typography.caption, fontWeight: '600' },
  fieldBlock: { gap: 8 },
  fieldLabel: { ...Typography.labelMd },
  fieldError: { ...Typography.bodySmall },
  typeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  typeFieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeFieldValue: { ...Typography.bodyMd, fontWeight: '600', flex: 1 },
  sheetHint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  typeList: { gap: Spacing.stackSm },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  typeOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionLabel: { ...Typography.bodyMd, fontWeight: '600', flex: 1 },
  typeOptionSpacer: { width: 20 },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
  reviewList: { gap: 0 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  reviewLabel: { ...Typography.bodyMd },
  reviewValue: { ...Typography.bodyLg, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
