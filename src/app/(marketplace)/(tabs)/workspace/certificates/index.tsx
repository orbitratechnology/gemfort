import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { canAccessModule, resolveProfileRole } from '@/constants/roles';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusinessByOwnerUid } from '@/features/marketplace/marketplace-service';
import {
  createClientNotification,
  fetchIncomingCertRequests,
  fetchLabCertificates,
  publishCertificate,
  respondCertificationRequest,
} from '@/features/marketplace/request-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { extensionForMedia, uploadLocalMedia, type LocalMedia } from '@/lib/firebase/storage-service';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function LabCertificatesScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = resolveProfileRole(profile);
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [showAdd, setShowAdd] = useState(add === '1');
  const [addParam, setAddParam] = useState(add);
  if (add !== addParam) {
    setAddParam(add);
    if (add === '1') setShowAdd(true);
  }
  const [certNumber, setCertNumber] = useState('');
  const [reportType, setReportType] = useState('full');
  const [file, setFile] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);

  const { data: certificates = [] } = useQuery({
    queryKey: ['lab-certificates', user?.uid],
    queryFn: () => fetchLabCertificates(user!.uid),
    enabled: !!user && canAccessModule(role, 'certificates'),
  });

  const { data: incoming = [] } = useQuery({
    queryKey: ['incoming-cert-requests', user?.uid],
    queryFn: () => fetchIncomingCertRequests(user!.uid),
    enabled: !!user && canAccessModule(role, 'certificates'),
  });

  const { data: business } = useQuery({
    queryKey: ['my-business', user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!canAccessModule(role, 'certificates')) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <StackHeader title="Certificates" />
        <EmptyState icon="lock" title="Gem Lab only" subtitle="Certificate management is for gem labs." />
      </SafeAreaView>
    );
  }

  async function publish(opts?: {
    requestId?: string;
    traderUid?: string | null;
    gemId?: string | null;
    gemName?: string | null;
  }) {
    Keyboard.dismiss();
    if (!user || !business) {
      toast.error('Create your business profile first.');
      return;
    }
    if (!certNumber.trim() || !file) {
      toast.error('Certificate number and file are required.');
      return;
    }
    setLoading(true);
    try {
      const fileUrl = await uploadLocalMedia(
        file,
        `certificates/${user.uid}/${Date.now()}.${extensionForMedia(file)}`,
      );
      const id = await publishCertificate({
        labUid: user.uid,
        labBusinessId: business.id,
        labName: business.businessName,
        certificateNumber: certNumber.trim(),
        reportType,
        fileUrl,
        fileType: file.mimeType?.includes('pdf') ? 'pdf' : 'image',
        gemId: opts?.gemId,
        gemName: opts?.gemName,
        traderUid: opts?.traderUid,
        certificationRequestId: opts?.requestId,
      });
      if (opts?.traderUid) {
        await createClientNotification({
          recipientUid: opts.traderUid,
          type: 'cert_ready',
          title: 'Certificate ready',
          message: `Report ${certNumber.trim()} is published and verifiable.`,
          referenceType: 'certificate',
          referenceId: id,
        });
      }
      setCertNumber('');
      setFile(null);
      setShowAdd(false);
      setFulfillingId(null);
      await queryClient.invalidateQueries({ queryKey: ['lab-certificates'] });
      await queryClient.invalidateQueries({ queryKey: ['incoming-cert-requests'] });
      toast.success('Certificate published.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not publish certificate.'));
    } finally {
      setLoading(false);
    }
  }

  const pending = incoming.filter((r) => r.status === 'pending' || r.status === 'accepted');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Certificates" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset style={styles.actions}>
        <Button title="Add certificate" icon="add" onPress={() => setShowAdd(true)} />
        <Button
          title="Public verify"
          variant="secondary"
          onPress={() => router.push('/verify-certificate' as never)}
        />
        </ScreenInset>

        {showAdd || fulfillingId ? (
          <FormSection title={fulfillingId ? 'Fulfill request' : 'New certificate'}>
            <Input label="Certificate / report number" value={certNumber} onChangeText={setCertNumber} />
            <Input label="Report type" value={reportType} onChangeText={setReportType} />
            <MediaField label="Certificate file / photo" value={file} onChange={setFile} allows="all" />
            <Button
              title="Publish"
              loading={loading}
              onPress={() => {
                const req = incoming.find((r) => r.id === fulfillingId);
                void publish({
                  requestId: req?.id,
                  traderUid: req?.traderUid,
                  gemId: req?.gemId,
                  gemName: req?.gemName,
                });
              }}
            />
          </FormSection>
        ) : null}

        <FormSectionLabel title="Requests" />
        <ScreenInset style={styles.sectionBody}>
        {pending.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No certification requests.</Text>
        ) : (
          pending.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{r.gemName}</Text>
              <Text style={{ color: colors.textMuted }}>
                {r.reportType} · {r.status}
              </Text>
              {r.status === 'pending' ? (
                <View style={styles.row}>
                  <Button
                    title="Accept"
                    onPress={async () => {
                      await respondCertificationRequest(r.id, 'accepted');
                      await createClientNotification({
                        recipientUid: r.traderUid,
                        type: 'cert_request_accepted',
                        title: 'Certification accepted',
                        message: 'The gem lab accepted your request.',
                        referenceType: 'certification_request',
                        referenceId: r.id,
                      });
                      setFulfillingId(r.id);
                      setShowAdd(true);
                      await queryClient.invalidateQueries({ queryKey: ['incoming-cert-requests'] });
                    }}
                  />
                  <Button
                    title="Reject"
                    variant="secondary"
                    onPress={async () => {
                      await respondCertificationRequest(r.id, 'rejected');
                      await createClientNotification({
                        recipientUid: r.traderUid,
                        type: 'cert_request_rejected',
                        title: 'Certification declined',
                        message: 'The gem lab declined your request.',
                        referenceType: 'certification_request',
                        referenceId: r.id,
                      });
                      await queryClient.invalidateQueries({ queryKey: ['incoming-cert-requests'] });
                    }}
                  />
                </View>
              ) : (
                <Button title="Upload certificate" onPress={() => { setFulfillingId(r.id); setShowAdd(true); }} />
              )}
            </View>
          ))
        )}
        </ScreenInset>

        <FormSectionLabel title="Published" />
        <ScreenInset style={styles.sectionBody}>
        {certificates.length === 0 ? (
          <EmptyState icon="workspace-premium" title="No certificates yet" subtitle="Published reports are public for verification." />
        ) : (
          certificates.map((c) => (
            <View key={c.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{c.certificateNumber}</Text>
              <Text style={{ color: colors.textMuted }}>
                {c.reportType}
                {c.gemName ? ` · ${c.gemName}` : ''}
              </Text>
            </View>
          ))
        )}
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: Spacing.md, paddingBottom: 48 },
  actions: { gap: Spacing.md },
  sectionBody: { gap: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  title: { ...Typography.headlineMdMobile, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
