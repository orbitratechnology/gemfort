import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { LAPIDARY_SERVICE_OPTIONS , isVerifiedRole, resolveProfileRole } from '@/constants/roles';
import { Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusiness, fetchBusinessByOwnerUid } from '@/features/marketplace/marketplace-service';
import {
  createCertificationRequest,
  createClientNotification,
  createServiceRequest,
} from '@/features/marketplace/request-service';
import { fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function RequestServiceOrCertScreen() {
  const { businessId, gemId: gemIdParam, mode } = useLocalSearchParams<{
    businessId: string;
    gemId?: string;
    mode?: 'service' | 'cert';
  }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>(['cutting']);
  const [reportType, setReportType] = useState('full');
  const [gemId, setGemId] = useState(gemIdParam ?? '');
  const [loading, setLoading] = useState(false);

  const requestMode = mode === 'cert' ? 'cert' : 'service';

  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => fetchBusiness(businessId!),
    enabled: !!businessId,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user && isVerifiedRole(profile, 'trader'),
  });

  const { data: myBusiness } = useQuery({
    queryKey: ['my-business', user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!isVerifiedRole(profile, 'trader')) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <StackHeader title="Request" />
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.textMuted }}>Only verified traders can send requests.</Text>
        </View>
      </SafeAreaView>
    );
  }

  async function submit() {
    if (!user || !business) return;
    const gem = gems.find((g) => g.id === gemId);
    if (!gem) {
      toast.error('Select a gem from your inventory.');
      return;
    }
    setLoading(true);
    try {
      if (requestMode === 'service') {
        if (serviceTypes.length === 0) {
          toast.error('Select at least one service.');
          return;
        }
        const id = await createServiceRequest({
          traderUid: user.uid,
          traderBusinessId: myBusiness?.id ?? null,
          lapidaryUid: business.ownerUid,
          lapidaryBusinessId: business.id,
          gemId: gem.id,
          gemName: gem.sku || gem.gemType,
          serviceTypes,
          notes,
        });
        await createClientNotification({
          recipientUid: business.ownerUid,
          type: 'service_request_received',
          title: 'New service request',
          message: `${profile?.displayName ?? 'A trader'} requested ${serviceTypes.join(', ')} for ${gem.sku || gem.gemType}.`,
          referenceType: 'service_request',
          referenceId: id,
        });
        toast.success('Service request sent.');
      } else {
        const id = await createCertificationRequest({
          traderUid: user.uid,
          traderBusinessId: myBusiness?.id ?? null,
          labUid: business.ownerUid,
          labBusinessId: business.id,
          gemId: gem.id,
          gemName: gem.sku || gem.gemType,
          reportType,
          notes,
        });
        await createClientNotification({
          recipientUid: business.ownerUid,
          type: 'cert_request_received',
          title: 'New certification request',
          message: `${profile?.displayName ?? 'A trader'} requested a ${reportType} report for ${gem.sku || gem.gemType}.`,
          referenceType: 'certification_request',
          referenceId: id,
        });
        toast.success('Certification request sent.');
      }
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not send request.'));
    } finally {
      setLoading(false);
    }
  }

  const gemOptions = gems.map((g) => ({
    value: g.id,
    label: g.sku || g.gemType,
    subtitle: g.gemType,
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title={requestMode === 'cert' ? 'Request certification' : 'Request service'} />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.biz, { color: colors.primary }]}>{business?.businessName}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Your gem</Text>
        <ChipSelect
          layout="stack"
          options={gemOptions.length ? gemOptions : [{ value: '', label: 'No gems — add one in Workspace' }]}
          value={gemId}
          onChange={setGemId}
        />

        {requestMode === 'service' ? (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>Services</Text>
            <View style={styles.wrap}>
              {LAPIDARY_SERVICE_OPTIONS.map((s) => {
                const active = serviceTypes.includes(s.id);
                return (
                  <Button
                    key={s.id}
                    title={s.label}
                    variant={active ? 'primary' : 'secondary'}
                    onPress={() =>
                      setServiceTypes((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                      )
                    }
                  />
                );
              })}
            </View>
          </>
        ) : (
          <Input label="Report type" value={reportType} onChangeText={setReportType} placeholder="full / brief / origin" />
        )}

        <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Button title="Send request" loading={loading} onPress={submit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  biz: { ...Typography.headlineSm, fontWeight: '700' },
  label: { ...Typography.labelMd, letterSpacing: 0.5 },
  wrap: { gap: 8 },
});
