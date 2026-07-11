import { Redirect, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { canAccessModule, resolveProfileRole } from '@/constants/roles';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchOutgoingCertRequests,
  fetchOutgoingServiceRequests,
} from '@/features/marketplace/request-service';
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

  const { data: certs = [] } = useQuery({
    queryKey: ['outgoing-cert-requests', user?.uid],
    queryFn: () => fetchOutgoingCertRequests(user!.uid),
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
      <StackHeader title="My requests" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.push('/verify-certificate')}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Verify a certificate →</Text>
        </Pressable>
        <Text style={[styles.section, { color: colors.textMuted }]}>SERVICES</Text>
        {services.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No service requests yet. Open a lapidary profile to request.</Text>
        ) : (
          services.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{r.gemName}</Text>
              <Text style={{ color: colors.textMuted }}>
                {r.serviceTypes.join(', ')} · {r.status}
              </Text>
            </View>
          ))
        )}
        <Text style={[styles.section, { color: colors.textMuted }]}>CERTIFICATION</Text>
        {certs.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No certification requests yet. Open a gem lab profile to request.</Text>
        ) : (
          certs.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.title, { color: colors.primary }]}>{r.gemName}</Text>
              <Text style={{ color: colors.textMuted }}>
                {r.reportType} · {r.status}
              </Text>
            </View>
          ))
        )}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.md, paddingBottom: 48 },
  section: { ...Typography.labelMd, letterSpacing: 1, marginTop: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 4 },
  title: { ...Typography.headlineMdMobile, fontWeight: '700' },
});
