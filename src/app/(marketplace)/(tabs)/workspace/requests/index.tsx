import { Redirect, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { StackHeader } from '@/components/ui/stack-header';
import { WorkspaceScreenBackdrop } from '@/components/workspace/workspace-screen-backdrop';
import { ThemedScrollView } from '@/components/ui/screen';
import { canAccessModule, resolveProfileRole } from '@/constants/roles';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchOutgoingServiceRequests } from '@/features/marketplace/request-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function TraderRequestsScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const role = resolveProfileRole(profile);

  const { data: services = [] } = useQuery({
    queryKey: ['outgoing-service-requests', user?.uid],
    queryFn: () => fetchOutgoingServiceRequests(user!.uid),
    enabled: !!user && canAccessModule(role, 'requests'),
  });

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!canAccessModule(role, 'requests')) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <StackHeader title="Requests" />
        <EmptyState icon="lock" title="Traders only" subtitle="Outgoing requests appear here." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <WorkspaceScreenBackdrop kind="requests" />
      <StackHeader title="My requests" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <Pressable onPress={() => router.push('/verify-certificate')}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              Verify a certificate →
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Certificates are verified on GemFort against lab uploads — not via lab requests.
          </Text>
        </ScreenInset>

        <FormSectionLabel title="Services" />
        <ScreenInset style={styles.sectionBody}>
          {services.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              No service requests yet. Open a lapidary profile to request.
            </Text>
          ) : (
            services.map((r) => (
              <View
                key={r.id}
                style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}
              >
                <Text style={[styles.title, { color: colors.primary }]}>{r.gemName}</Text>
                <Text style={{ color: colors.textMuted }}>
                  {r.serviceTypes.join(', ')} · {r.status}
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
  sectionBody: { gap: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 4 },
  title: { ...Typography.headlineMdMobile, fontWeight: '700' },
});
