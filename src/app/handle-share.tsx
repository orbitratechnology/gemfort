import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';

/**
 * Handles content shared *into* GemFort (Photos, Files, WhatsApp, etc.).
 * Requires a native rebuild after enabling the expo-sharing config plugin.
 */
export default function HandleShareScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const {
    resolvedSharedPayloads,
    sharedPayloads,
    isResolving,
    error,
    clearSharedPayloads,
  } = useIncomingShare();

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const images = useMemo(
    () =>
      resolvedSharedPayloads.filter(
        (p) => p.contentType === 'image' && p.contentUri,
      ),
    [resolvedSharedPayloads],
  );

  const files = useMemo(
    () =>
      resolvedSharedPayloads.filter(
        (p) =>
          (p.contentType === 'file' || p.contentMimeType?.includes('pdf')) &&
          p.contentUri,
      ),
    [resolvedSharedPayloads],
  );

  const imageUris = images
    .map((p) => p.contentUri)
    .filter((uri): uri is string => !!uri);

  function finishAndClear() {
    clearSharedPayloads();
    haptics.light();
  }

  function goAddGem() {
    finishAndClear();
    // Prefill via params when add-gem supports shared URIs; navigate for now.
    router.replace({
      pathname: '/(marketplace)/(tabs)/workspace/gems/add',
      params: imageUris.length
        ? { sharedImageUris: JSON.stringify(imageUris) }
        : undefined,
    } as Href);
  }

  function goGem(gemId: string) {
    finishAndClear();
    router.replace(`/(marketplace)/(tabs)/workspace/gems/${gemId}` as Href);
  }

  function dismiss() {
    finishAndClear();
    if (router.canGoBack()) router.back();
    else router.replace('/(marketplace)/(tabs)/workspace' as Href);
  }

  const hasContent =
    resolvedSharedPayloads.length > 0 || sharedPayloads.length > 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}>
      <StackHeader title="Add to GemFort" closeIcon onBack={dismiss} />

      {isResolving ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Preparing shared content…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState
            icon="error"
            title="Couldn’t read shared content"
            subtitle={error.message}
          />
          <Button title="Dismiss" variant="secondary" onPress={dismiss} />
        </View>
      ) : !hasContent ? (
        <View style={styles.center}>
          <EmptyState
            icon="share"
            title="Nothing shared"
            subtitle="Share photos or PDFs to GemFort from Photos, Files, or another app."
          />
          <Button title="Close" variant="secondary" onPress={dismiss} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic">
          {images.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Photos ({images.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}>
                {images.map((payload, index) => (
                  <Image
                    key={`${payload.contentUri}-${index}`}
                    source={{ uri: payload.contentUri! }}
                    style={[
                      styles.thumb,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
              <Button
                title="Add as new gem"
                icon="diamond"
                onPress={goAddGem}
              />
            </View>
          ) : null}

          {files.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Documents ({files.length})
              </Text>
              {files.map((payload, index) => (
                <View
                  key={`${payload.contentUri}-${index}`}
                  style={[
                    styles.fileRow,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}>
                  <Icon name="picture-as-pdf" size={22} color={colors.error} />
                  <Text
                    style={[styles.fileName, { color: colors.onSurface }]}
                    numberOfLines={2}
                    selectable>
                    {payload.originalName ?? 'Shared file'}
                  </Text>
                </View>
              ))}
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Open a gem to attach certificates after sharing, or add a new gem
                first.
              </Text>
            </View>
          ) : null}

          {user && gems.length > 0 && (images.length > 0 || files.length > 0) ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Attach to existing gem
              </Text>
              {gems.slice(0, 12).map((gem) => (
                <Pressable
                  key={gem.id}
                  onPress={() => goGem(gem.id)}
                  style={({ pressed }) => [
                    styles.gemRow,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open gem ${gem.sku}`}>
                  <Text style={[styles.gemSku, { color: colors.onSurface }]}>
                    {gem.sku}
                  </Text>
                  <Text style={[styles.gemMeta, { color: colors.textMuted }]}>
                    {gem.currentWeight} ct
                  </Text>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Button title="Dismiss" variant="ghost" onPress={dismiss} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  content: {
    padding: Spacing.containerMargin,
    gap: Spacing.gutterMd,
    paddingBottom: Spacing.xxl,
  },
  section: { gap: Spacing.md },
  sectionTitle: { ...Typography.headlineSm },
  thumbs: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  fileName: { ...Typography.bodyMd, flex: 1 },
  gemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  gemSku: { ...Typography.bodyMd, fontWeight: '600', flex: 1 },
  gemMeta: { ...Typography.bodySmall },
  hint: { ...Typography.bodySmall, textAlign: 'center' },
});
