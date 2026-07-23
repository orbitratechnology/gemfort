import { Redirect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { canAccessModule, resolveProfileRole } from '@/constants/roles';
import {
  fetchIncomingServiceRequests,
  fetchLapidaryJobs,
  respondServiceRequest,
  updateLapidaryJobStatus,
 createClientNotification } from '@/features/marketplace/request-service';
import { respondServiceCancellation } from '@/features/workspace/service-lifecycle-service';
import { fetchProviderServices } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function LapidaryJobsScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = resolveProfileRole(profile);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['lapidary-jobs', user?.uid],
    queryFn: () => fetchLapidaryJobs(user!.uid),
    enabled: !!user && canAccessModule(role, 'jobs'),
  });

  const { data: incoming = [] } = useQuery({
    queryKey: ['incoming-service-requests', user?.uid],
    queryFn: () => fetchIncomingServiceRequests(user!.uid),
    enabled: !!user && canAccessModule(role, 'jobs'),
  });

  const { data: providerServices = [] } = useQuery({
    queryKey: ['provider-services', user?.uid],
    queryFn: () => fetchProviderServices(user!.uid),
    enabled: !!user && canAccessModule(role, 'jobs'),
  });

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!canAccessModule(role, 'jobs')) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <StackHeader title="Jobs" />
        <EmptyState icon="lock" title="Lapidary only" subtitle="Jobs are for lapidary workshops." />
      </SafeAreaView>
    );
  }

  async function onRespond(id: string, decision: 'accepted' | 'rejected', traderUid: string) {
    try {
      await respondServiceRequest(id, decision);
      await createClientNotification({
        recipientUid: traderUid,
        type: decision === 'accepted' ? 'service_request_accepted' : 'service_request_rejected',
        title: decision === 'accepted' ? 'Service request accepted' : 'Service request declined',
        message:
          decision === 'accepted'
            ? 'Your lapidary accepted the job. Tracking is synced.'
            : 'Your lapidary declined this service request.',
        referenceType: 'service_request',
        referenceId: id,
      });
      await queryClient.invalidateQueries({ queryKey: ['incoming-service-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['lapidary-jobs'] });
      toast.success(decision === 'accepted' ? 'Job accepted.' : 'Request declined.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update request.'));
    }
  }

  async function onJobStatus(jobId: string, status: 'in_progress' | 'ready' | 'returned', traderUid: string) {
    try {
      await updateLapidaryJobStatus(jobId, status);
      await createClientNotification({
        recipientUid: traderUid,
        type: 'service_job_updated',
        title: 'Workshop update',
        message: `Job status is now ${status.replace('_', ' ')}.`,
        referenceType: 'lapidary_job',
        referenceId: jobId,
      });
      await queryClient.invalidateQueries({ queryKey: ['lapidary-jobs'] });
      toast.success('Job updated.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update job.'));
    }
  }

  const pending = incoming.filter((r) => r.status === 'pending');
  const cancellationRequests = providerServices.filter(
    (s) => s.status === 'cancellation_requested',
  );

  async function onRespondCancellation(serviceId: string, action: 'accepted' | 'rejected') {
    try {
      await respondServiceCancellation(serviceId, action);
      await queryClient.invalidateQueries({ queryKey: ['provider-services'] });
      toast.success(action === 'accepted' ? 'Service cancelled.' : 'Cancellation declined.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not respond to cancellation.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Workshop jobs" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSectionLabel title="Incoming requests" />
        <ScreenInset style={styles.sectionBody}>
        {pending.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No pending service requests.</Text>
        ) : (
          pending.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{r.gemName}</Text>
              <Text style={{ color: colors.textMuted }}>{r.serviceTypes.join(', ')}</Text>
              {r.notes ? <Text style={{ color: colors.onSurfaceVariant }}>{r.notes}</Text> : null}
              <View style={styles.row}>
                <Button title="Accept" onPress={() => onRespond(r.id, 'accepted', r.traderUid)} />
                <Button title="Reject" variant="secondary" onPress={() => onRespond(r.id, 'rejected', r.traderUid)} />
              </View>
            </View>
          ))
        )}
        </ScreenInset>

        {cancellationRequests.length > 0 ? (
          <>
            <FormSectionLabel title="Cancellation requests" />
            <ScreenInset style={styles.sectionBody}>
              {cancellationRequests.map((s) => (
                <View key={s.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
                  <Text style={[styles.title, { color: colors.primary }]}>
                    {s.serviceType.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ color: colors.textMuted }}>
                    A trader asked to cancel this service.
                  </Text>
                  <View style={styles.row}>
                    <Button title="Accept" onPress={() => onRespondCancellation(s.id, 'accepted')} />
                    <Button
                      title="Decline"
                      variant="secondary"
                      onPress={() => onRespondCancellation(s.id, 'rejected')}
                    />
                  </View>
                </View>
              ))}
            </ScreenInset>
          </>
        ) : null}

        <FormSectionLabel title="Active jobs" />
        <ScreenInset style={styles.sectionBody}>
        {isLoading ? <Text style={{ color: colors.textMuted }}>Loading…</Text> : null}
        {jobs.length === 0 && !isLoading ? (
          <EmptyState icon="construction" title="No jobs yet" subtitle="Accepted trader stones appear here." />
        ) : (
          jobs.map((j) => (
            <Pressable
              key={j.id}
              style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{j.gemName}</Text>
              <Text style={{ color: colors.textMuted }}>
                {j.serviceTypes.join(', ')} · {j.status}
              </Text>
              <View style={styles.row}>
                {j.status === 'queued' ? (
                  <Button title="Start" onPress={() => onJobStatus(j.id, 'in_progress', j.traderUid)} />
                ) : null}
                {j.status === 'in_progress' ? (
                  <Button title="Mark ready" onPress={() => onJobStatus(j.id, 'ready', j.traderUid)} />
                ) : null}
                {j.status === 'ready' ? (
                  <Button title="Returned" onPress={() => onJobStatus(j.id, 'returned', j.traderUid)} />
                ) : null}
              </View>
            </Pressable>
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
  sectionBody: { gap: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  title: { ...Typography.headlineMdMobile, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
