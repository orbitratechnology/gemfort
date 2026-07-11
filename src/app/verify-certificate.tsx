import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { verifyCertificateByNumber } from '@/features/marketplace/request-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import type { PublicCertificate } from '@/types';

export default function VerifyCertificateScreen() {
  const { colors } = useAppTheme();
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicCertificate | null | undefined>(undefined);

  async function onSearch() {
    Keyboard.dismiss();
    if (!number.trim()) return;
    setLoading(true);
    try {
      const cert = await verifyCertificateByNumber(number.trim());
      setResult(cert);
    } catch (e) {
      setResult(null);
      console.warn(friendlyError(e, 'Verify failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Verify certificate" />
      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Enter a certificate or report number issued by a GemFort Gem Lab.
        </Text>
        <Input
          label="Certificate / report number"
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          leftIcon="workspace-premium"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onSearch}
        />
        <Button title="Verify" loading={loading} onPress={onSearch} />

        {result === null ? (
          <View style={[styles.card, { backgroundColor: colors.error + '14' }]}>
            <Text style={{ color: colors.error, fontWeight: '700' }}>No matching public certificate</Text>
          </View>
        ) : null}

        {result ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.title, { color: colors.primary }]}>{result.certificateNumber}</Text>
            <Text style={{ color: colors.textMuted }}>Lab: {result.labName}</Text>
            <Text style={{ color: colors.textMuted }}>Report: {result.reportType}</Text>
            {result.gemName ? <Text style={{ color: colors.onSurface }}>Gem: {result.gemName}</Text> : null}
            {result.verificationCode ? (
              <Text style={{ color: colors.onSurfaceVariant }}>Code: {result.verificationCode}</Text>
            ) : null}
            <Button title="Open file" variant="secondary" onPress={() => Linking.openURL(result.fileUrl)} />
          </View>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.containerMargin, gap: Spacing.md },
  lead: { ...Typography.bodyMd },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  title: { ...Typography.headlineSm, fontWeight: '700' },
});
