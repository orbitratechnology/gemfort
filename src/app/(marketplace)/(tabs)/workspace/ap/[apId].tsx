import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchApRecords,
  recordApReturn,
  recordApSale,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function ApDetailScreen() {
  const { apId } = useLocalSearchParams<{ apId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [soldPrice, setSoldPrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [outcome, setOutcome] = useState<'sold' | 'returned'>('sold');
  const [loading, setLoading] = useState(false);

  const { data: records = [] } = useQuery({
    queryKey: ['ap', user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    enabled: !!user,
  });

  const ap = records.find((r) => r.id === apId);

  if (!ap) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Text style={[styles.loading, { color: colors.textMuted }]}>Loading...</Text>
    </SafeAreaView>
  );

  async function handleConfirm() {
    if (!user) return;
    setLoading(true);
    try {
      if (outcome === 'sold') {
        if (!soldPrice) throw new Error('Please enter sale price');
        await recordApSale(apId!, user.uid, parseFloat(soldPrice));
        Alert.alert('Recorded', 'AP sale recorded');
      } else {
        await recordApReturn(apId!, user.uid);
        Alert.alert('Recorded', 'Gem returned from AP');
      }
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top App Bar */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
          <Text style={[styles.title, { color: colors.primary }]}>Record AP</Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Icon name="close" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Summary Card */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Stone Details</Text>
          <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
            <View style={styles.cardRow}>
              <View style={[styles.gemImageWrap, { backgroundColor: colors.surfaceVariant }]}>
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYLE7_KfgJ_MVYQj8rxpDst-2Zx_N56ghCV9_G9lMPB2CsH0NB1VR7RW1oDOfFJK-4b7ELvRJBvs0YT59P4zvwfBWDvUzv31HrwoQWQkWZrm2FotH06o_4x9WWT8NykR6gFAGVwT7EGEWs9AWrSJgUH7XSL0ikPt_hBESIDPFg-JziXbmaPcT14ukrgAJzKyosCxlBxZgImYbItpaCQVomA7e5SfMqn-_grncoe5dv8Cf7wrMlv1kdyA' }} 
                  style={styles.gemImage} 
                />
              </View>
              <View style={styles.gemInfo}>
                <View style={styles.gemMetaRow}>
                  <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>AP-{ap.id.slice(0,4)}</Text>
                  </View>
                  <Text style={[styles.refText, { color: colors.textMuted }]}>Ref: {ap.gemId.slice(0,4)}</Text>
                </View>
                <Text style={[styles.gemTitle, { color: colors.onSurface }]}>Blue Sapphire</Text>
                <Text style={[styles.gemDesc, { color: colors.onSurfaceVariant }]}>Min: {formatCurrency(ap.ownerMinimumPrice, ap.currency)} • {formatDate(ap.dateGiven)}</Text>
              </View>
            </View>
          </View>
        </View>

        {ap.status === 'with_holder' || ap.status === 'overdue' ? (
          <>
            {/* Outcome Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Outcome</Text>
              <View style={styles.outcomeGrid}>
                <Pressable 
                  style={[
                    styles.outcomeCard, 
                    { backgroundColor: colors.surfaceGlass, borderColor: outcome === 'sold' ? colors.primary : 'transparent' },
                    outcome === 'sold' && { backgroundColor: colors.primaryFixed + '33' }
                  ]}
                  onPress={() => setOutcome('sold')}
                >
                  <View style={[styles.outcomeIconWrap, { backgroundColor: outcome === 'sold' ? colors.primary : colors.surfaceContainerHighest }]}>
                    <Icon name="payments" size={24} color={outcome === 'sold' ? colors.onPrimary : colors.onSurfaceVariant} />
                  </View>
                  <Text style={[styles.outcomeText, { color: colors.onSurface }]}>Sold</Text>
                  {outcome === 'sold' && (
                    <View style={styles.checkIcon}>
                      <Icon name="check-circle" size={20} color={colors.primary} />
                    </View>
                  )}
                </Pressable>

                <Pressable 
                  style={[
                    styles.outcomeCard, 
                    { backgroundColor: colors.surfaceGlass, borderColor: outcome === 'returned' ? colors.primary : 'transparent' },
                    outcome === 'returned' && { backgroundColor: colors.primaryFixed + '33' }
                  ]}
                  onPress={() => setOutcome('returned')}
                >
                  <View style={[styles.outcomeIconWrap, { backgroundColor: outcome === 'returned' ? colors.primary : colors.surfaceContainerHighest }]}>
                    <Icon name="keyboard-return" size={24} color={outcome === 'returned' ? colors.onPrimary : colors.onSurfaceVariant} />
                  </View>
                  <Text style={[styles.outcomeText, { color: colors.onSurface }]}>Returned</Text>
                  {outcome === 'returned' && (
                    <View style={styles.checkIcon}>
                      <Icon name="check-circle" size={20} color={colors.primary} />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Conditional Inputs */}
            {outcome === 'sold' ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Sale Details</Text>
                <View style={styles.inputGroup}>
                  <Input 
                    label="Final Sale Price (USD)" 
                    value={soldPrice} 
                    onChangeText={setSoldPrice} 
                    keyboardType="decimal-pad" 
                    placeholder="0.00"
                  />
                  <Input 
                    label="Buyer/Client" 
                    value={buyerName} 
                    onChangeText={setBuyerName} 
                    placeholder="Search or enter name"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Return Details</Text>
                <View style={styles.inputGroup}>
                  <Input 
                    label="Reason / Notes (Optional)" 
                    value={returnNotes} 
                    onChangeText={setReturnNotes} 
                    multiline
                    placeholder="e.g., Client preferred a different cut"
                  />
                </View>
              </View>
            )}

            {/* Action Button */}
            <View style={styles.actionArea}>
              <Button 
                title="Confirm AP Record" 
                onPress={handleConfirm} 
                loading={loading}
                style={[styles.confirmBtn, { backgroundColor: colors.secondaryContainer }]}
                textStyle={{ color: colors.onSecondaryContainer as any }}
              />
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Status</Text>
            <Text style={{ color: colors.textMuted }}>This AP stone has already been {ap.status}.</Text>
          </View>
        )}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
    zIndex: 40,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { padding: 4, marginLeft: -8, borderRadius: Radius.full },
  title: { ...Typography.headlineMdMobile },
  
  content: { padding: Spacing.containerMargin, gap: Spacing.sectionGap, paddingBottom: 100 },
  
  section: { gap: Spacing.stackMd },
  sectionTitle: { ...Typography.headlineSm },
  
  glassCard: {
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  gemImageWrap: { width: 80, height: 80, borderRadius: Radius.md, overflow: 'hidden' },
  gemImage: { width: '100%', height: '100%' },
  gemInfo: { flex: 1 },
  gemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { ...Typography.labelMd },
  refText: { ...Typography.bodyMd },
  gemTitle: { ...Typography.headlineSm, lineHeight: 24 },
  gemDesc: { ...Typography.bodyMd, marginTop: 4 },

  outcomeGrid: { flexDirection: 'row', gap: Spacing.gutterMd },
  outcomeCard: {
    flex: 1,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 120,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  outcomeIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  outcomeText: { ...Typography.headlineSm },
  checkIcon: { position: 'absolute', top: 12, right: 12, fontSize: 20, fontWeight: 'bold' },

  inputGroup: { gap: Spacing.stackMd },

  actionArea: { paddingTop: Spacing.stackMd },
  confirmBtn: {
    height: 56,
    shadowColor: '#e6c364',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
});
