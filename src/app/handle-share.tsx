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

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';
import {
  collectFileUris,
  collectImageUris,
  collectShareTexts,
  encodeShareParam,
  parseSharedText,
} from '@/lib/incoming-share';
import { useAuth } from '@/providers/auth-provider';

type Destination = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  enabled: boolean;
  onPress: () => void;
};

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

  const imageUris = useMemo(
    () => collectImageUris(resolvedSharedPayloads),
    [resolvedSharedPayloads],
  );
  const files = useMemo(
    () => collectFileUris(resolvedSharedPayloads),
    [resolvedSharedPayloads],
  );
  const shareText = useMemo(
    () => collectShareTexts(resolvedSharedPayloads, sharedPayloads),
    [resolvedSharedPayloads, sharedPayloads],
  );
  const parsed = useMemo(() => parseSharedText(shareText), [shareText]);

  const hasImages = imageUris.length > 0;
  const hasFiles = files.length > 0;
  const hasText = shareText.length > 0;
  const hasContent = hasImages || hasFiles || hasText || sharedPayloads.length > 0;

  function finishAndClear() {
    clearSharedPayloads();
    haptics.selection();
  }

  function go(href: Href) {
    finishAndClear();
    router.replace(href);
  }

  function gemParams() {
    return imageUris.length
      ? { sharedImageUris: JSON.stringify(imageUris) }
      : undefined;
  }

  function chequeParams() {
    const params: Record<string, string> = {};
    if (imageUris[0]) params.sharedImageUri = imageUris[0];
    if (parsed.amount) params.amount = parsed.amount;
    if (shareText) params.notes = encodeShareParam(shareText.slice(0, 500));
    return Object.keys(params).length ? params : undefined;
  }

  function billParams() {
    const params: Record<string, string> = {};
    if (parsed.amount) params.amount = parsed.amount;
    const noteParts = [
      shareText.slice(0, 400),
      hasImages ? `(${imageUris.length} shared photo${imageUris.length > 1 ? 's' : ''})` : '',
      hasFiles ? files.map((f) => f.name ?? 'file').join(', ') : '',
    ].filter(Boolean);
    if (noteParts.length) params.notes = encodeShareParam(noteParts.join('\n'));
    return Object.keys(params).length ? params : undefined;
  }

  function contactParams() {
    const params: Record<string, string> = {};
    if (parsed.displayName) params.displayName = encodeShareParam(parsed.displayName);
    if (parsed.phone) params.phone = parsed.phone;
    if (parsed.email) params.email = encodeShareParam(parsed.email);
    if (shareText && !parsed.phone && !parsed.email) {
      params.notes = encodeShareParam(shareText.slice(0, 500));
    } else if (shareText && (parsed.phone || parsed.email)) {
      // Keep leftover text as notes without duplicating phone/email lines heavily
      params.notes = encodeShareParam(shareText.slice(0, 300));
    }
    if (imageUris[0]) params.sharedPhotoUri = imageUris[0];
    return Object.keys(params).length ? params : undefined;
  }

  const destinations: Destination[] = [
    {
      id: 'gem',
      title: 'Add gem',
      subtitle: hasImages
        ? `Use ${imageUris.length} photo${imageUris.length > 1 ? 's' : ''} in the album`
        : 'Needs a shared photo',
      icon: 'diamond',
      enabled: !!user && hasImages,
      onPress: () =>
        go({
          pathname: '/(marketplace)/(tabs)/workspace/gems/add',
          params: gemParams(),
        } as Href),
    },
    {
      id: 'cheque',
      title: 'Add cheque',
      subtitle: hasImages
        ? 'Attach shared photo of the cheque'
        : parsed.amount
          ? `Pre-fill amount ${parsed.amount}`
          : hasText
            ? 'Pre-fill notes from shared text'
            : 'Share a cheque photo or amount',
      icon: 'money-check-dollar',
      enabled: !!user && (hasImages || hasText),
      onPress: () =>
        go({
          pathname: '/(marketplace)/(tabs)/workspace/cheques/add',
          params: chequeParams(),
        } as Href),
    },
    {
      id: 'bill',
      title: 'Add bill',
      subtitle: parsed.amount
        ? `Pre-fill amount ${parsed.amount}`
        : hasText || hasImages || hasFiles
          ? 'Pre-fill notes from shared content'
          : 'Share text with an amount or invoice details',
      icon: 'receipt-long',
      enabled: !!user && (hasText || hasImages || hasFiles),
      onPress: () =>
        go({
          pathname: '/(marketplace)/(tabs)/workspace/bills/add',
          params: billParams(),
        } as Href),
    },
    {
      id: 'contact',
      title: 'Add contact',
      subtitle: parsed.phone
        ? `Phone ${parsed.phone}`
        : parsed.displayName
          ? parsed.displayName
          : hasImages
            ? 'Use shared photo as avatar'
            : hasText
              ? 'Pre-fill from shared text'
              : 'Share a number, name, or photo',
      icon: 'person-add',
      enabled: !!user && (hasText || hasImages),
      onPress: () =>
        go({
          pathname: '/(marketplace)/(tabs)/workspace/contacts/add',
          params: contactParams(),
        } as Href),
    },
  ];

  function dismiss() {
    finishAndClear();
    if (router.canGoBack()) router.back();
    else router.replace('/(marketplace)/(tabs)/workspace' as Href);
  }

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
            subtitle="Share photos, PDFs, or text to GemFort from Photos, Files, WhatsApp, or another app."
          />
          <Button title="Close" variant="secondary" onPress={dismiss} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic">
          {!user ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}>
              <Text style={[styles.bannerText, { color: colors.onSurface }]} selectable>
                Sign in to save shared content into your workspace.
              </Text>
              <Button
                title="Sign in"
                onPress={() => {
                  finishAndClear();
                  router.replace('/(auth)/login' as Href);
                }}
              />
            </View>
          ) : null}

          {hasImages ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Photos ({imageUris.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}>
                {imageUris.map((uri, index) => (
                  <Image
                    key={`${uri}-${index}`}
                    source={{ uri }}
                    style={[
                      styles.thumb,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {hasFiles ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Documents ({files.length})
              </Text>
              {files.map((file, index) => (
                <View
                  key={`${file.uri}-${index}`}
                  style={[
                    styles.fileRow,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}>
                  <Icon name="picture-as-pdf" size={22} color={colors.error} />
                  <Text
                    style={[styles.fileName, { color: colors.onSurface }]}
                    numberOfLines={2}
                    selectable>
                    {file.name ?? 'Shared file'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasText ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Text
              </Text>
              <View
                style={[
                  styles.textPreview,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}>
                <Text
                  style={[styles.textBody, { color: colors.onSurface }]}
                  selectable
                  numberOfLines={6}>
                  {shareText}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              What do you want to create?
            </Text>
            {destinations.map((dest) => (
              <Pressable
                key={dest.id}
                disabled={!dest.enabled}
                onPress={dest.onPress}
                accessibilityRole="button"
                accessibilityState={{ disabled: !dest.enabled }}
                accessibilityLabel={dest.title}
                style={({ pressed }) => [
                  styles.destRow,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    opacity: !dest.enabled ? 0.45 : pressed ? 0.9 : 1,
                  },
                ]}>
                <View
                  style={[
                    styles.destIcon,
                    { backgroundColor: colors.primaryContainer },
                  ]}>
                  <Icon
                    name={dest.icon}
                    size={22}
                    color={colors.onPrimaryContainer}
                  />
                </View>
                <View style={styles.destBody}>
                  <Text style={[styles.destTitle, { color: colors.onSurface }]}>
                    {dest.title}
                  </Text>
                  <Text
                    style={[styles.destSub, { color: colors.textMuted }]}
                    numberOfLines={2}>
                    {dest.subtitle}
                  </Text>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            ))}
          </View>

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
  textPreview: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  textBody: { ...Typography.bodyMd },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    minHeight: 64,
  },
  destIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destBody: { flex: 1, gap: 2, minWidth: 0 },
  destTitle: { ...Typography.bodyMd, fontWeight: '600' },
  destSub: { ...Typography.bodySmall },
  hint: { ...Typography.bodySmall, textAlign: 'center' },
  banner: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    gap: Spacing.sm,
  },
  bannerText: { ...Typography.bodyMd },
});
