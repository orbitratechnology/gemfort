import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { GEM_TYPES } from '@/constants/gem-options';
import { Palette, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createGem } from '@/features/workspace/workspace-service';
import { uploadPickedImage } from '@/lib/firebase/storage-service';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

export default function AddGemScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [gemType, setGemType] = useState('blue_sapphire');
  const [originCountry, setOriginCountry] = useState('');
  const [roughWeight, setRoughWeight] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [treatment, setTreatment] = useState('none');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleNext() {
    if (step === 1) {
      if (!roughWeight.trim() || !acquisitionCost.trim()) {
        toast.error('Please enter weight and price.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!user) return;
    setLoading(true);
    try {
      const gemId = await createGem(user.uid, {
        gemType,
        originCountry,
        roughWeight: parseFloat(roughWeight) || 0,
        acquisitionCost: parseFloat(acquisitionCost) || 0,
        colorPrimary: null,
        notes: `Treatment: ${treatment}`,
        photoUrls: photoUrl ? [photoUrl] : [],
      });
      toast.success('Gem added to your inventory');
      router.replace(`/(marketplace)/(tabs)/workspace/gems/${gemId}`);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add gem.'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoto() {
    if (!user) return;
    const url = await uploadPickedImage(`gemtrack_gems/${user.uid}/${Date.now()}.jpg`);
    if (url) setPhotoUrl(url);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Navigation */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.primary }]}>Add Gem</Text>
        <View style={styles.spacer} />
      </View>

      <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={styles.stepCol}>
            <View style={[styles.stepCircle, step >= 1 ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.stepNum, step >= 1 ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }]}>1</Text>
            </View>
            <Text style={[styles.stepText, step >= 1 ? { color: colors.primary } : { color: colors.onSurfaceVariant }]}>Details</Text>
          </View>
          <View style={[styles.stepLine, { backgroundColor: step >= 2 ? colors.primary : colors.surfaceVariant }]} />
          <View style={[styles.stepCol, step < 2 && styles.stepFaded]}>
            <View style={[styles.stepCircle, step >= 2 ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.stepNum, step >= 2 ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }]}>2</Text>
            </View>
            <Text style={[styles.stepText, step >= 2 ? { color: colors.primary } : { color: colors.onSurfaceVariant }]}>Photos</Text>
          </View>
          <View style={[styles.stepLine, { backgroundColor: step >= 3 ? colors.primary : colors.surfaceVariant }]} />
          <View style={[styles.stepCol, step < 3 && styles.stepFaded]}>
            <View style={[styles.stepCircle, step >= 3 ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.stepNum, step >= 3 ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }]}>3</Text>
            </View>
            <Text style={[styles.stepText, step >= 3 ? { color: colors.primary } : { color: colors.onSurfaceVariant }]}>Review</Text>
          </View>
        </View>

        {/* Form Section */}
        {step === 1 && (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Gem Type</Text>
              <View style={styles.typeGrid}>
                {GEM_TYPES.map((t) => (
                  <Pressable
                    key={t.value}
                    style={[
                      styles.typeChip,
                      { borderColor: colors.outlineVariant },
                      gemType === t.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setGemType(t.value)}>
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: colors.onSurfaceVariant },
                        gemType === t.value && { color: colors.onPrimary },
                      ]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flex1}>
                <Input
                  label="Weight (ct)"
                  value={roughWeight}
                  onChangeText={setRoughWeight}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
              <View style={styles.flex1}>
                <Input
                  label="Purchase Price"
                  value={acquisitionCost}
                  onChangeText={setAcquisitionCost}
                  keyboardType="decimal-pad"
                  placeholder="$ 0.00"
                />
              </View>
            </View>

            <Input
              label="Origin"
              value={originCountry}
              onChangeText={setOriginCountry}
              placeholder="e.g. Sri Lanka, Colombia"
            />

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Treatment</Text>
              <View style={styles.typeGrid}>
                {['none', 'heat', 'oil', 'irradiation'].map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeChip,
                      { borderColor: colors.outlineVariant },
                      treatment === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setTreatment(t)}>
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: colors.onSurfaceVariant },
                        treatment === t && { color: colors.onPrimary },
                      ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <Pressable 
            style={[styles.photoCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}
            onPress={handlePhoto}
          >
            <View style={[styles.photoIconWrap, { backgroundColor: colors.primaryFixed }]}>
              <Icon name="add-a-photo" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.photoTitle, { color: colors.primary }]}>Upload Gem Photo</Text>
            <Text style={[styles.photoSub, { color: colors.textMuted }]}>Tap to open camera or select from gallery</Text>
            {photoUrl && <Text style={{ color: colors.successEmerald, marginTop: 8 }}>Photo Added ✓</Text>}
          </Pressable>
        )}

        {step === 3 && (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Review Details</Text>
            <Text style={{ color: colors.textMain, marginTop: 8 }}>Type: {gemType}</Text>
            <Text style={{ color: colors.textMain, marginTop: 4 }}>Weight: {roughWeight} ct</Text>
            <Text style={{ color: colors.textMain, marginTop: 4 }}>Price: ${acquisitionCost}</Text>
            <Text style={{ color: colors.textMain, marginTop: 4 }}>Origin: {originCountry}</Text>
            <Text style={{ color: colors.textMain, marginTop: 4 }}>Treatment: {treatment}</Text>
            {photoUrl && <Text style={{ color: colors.successEmerald, marginTop: 8 }}>Photo Included</Text>}
          </View>
        )}
      </ThemedScrollView>

      {/* Bottom Action Area */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surfaceGlass, borderTopColor: colors.surfaceVariant }]}>
        <Button 
          title={step === 3 ? "Confirm & Save" : "Continue"} 
          onPress={handleNext} 
          loading={loading}
          style={styles.actionBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
    zIndex: 40,
  },
  backBtn: { padding: 8, borderRadius: Radius.full },
  backIcon: { fontSize: 24, fontWeight: 'bold' },
  title: { ...Typography.headlineMdMobile },
  spacer: { width: 40 },
  container: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.sectionGap, paddingBottom: 100 },
  
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  stepCol: { alignItems: 'center', gap: 4, width: '33%' },
  stepFaded: { opacity: 0.5 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNum: { ...Typography.labelMd },
  stepText: { ...Typography.labelMd },
  stepLine: { height: 2, flex: 1, marginHorizontal: 8 },

  card: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.stackMd,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 5,
  },
  fieldWrap: { gap: 4 },
  label: { ...Typography.labelMd },
  row: { flexDirection: 'row', gap: Spacing.stackMd },
  flex1: { flex: 1 },
  
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackSm },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  typeChipText: { ...Typography.bodyMd },

  photoCard: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.stackSm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 160,
  },
  photoIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  photoIcon: { fontSize: 24 },
  photoTitle: { ...Typography.headlineMdMobile },
  photoSub: { ...Typography.bodyMd, textAlign: 'center', maxWidth: 200 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.containerMargin,
    borderTopWidth: 1,
  },
  actionBtn: {
    width: '100%',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 5,
  },
});
