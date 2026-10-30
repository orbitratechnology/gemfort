import { Image, type ImageSource } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Accent } from '@/components/ui/detail-kit';
import { Icon, type IconName } from '@/components/ui/icon';
import { canAccessModule, resolveProfileRole, type WorkspaceModule } from '@/constants/roles';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { WORKSPACE_ENTITY_IMAGES } from '@/constants/workspace-entity-images';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { capturePhoto, scanDocuments } from '@/lib/scan';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export type ScanTarget = 'gem' | 'cheque' | 'bill' | 'receipt' | 'passport';

type TargetConfig = {
  id: ScanTarget;
  label: string;
  hint: string;
  icon: IconName;
  image?: ImageSource;
  accent: string;
  module: WorkspaceModule;
  /** Gems are 3-D: a plain photo. Everything else is a flat document scan. */
  mode: 'photo' | 'document';
  maxPages: number;
  /** Where the capture lands, with the local file URIs as route params. */
  href: (uris: string[]) => Href;
};

const TARGETS: TargetConfig[] = [
  {
    id: 'gem',
    label: 'Gem',
    hint: 'Photo → Add gem',
    icon: 'diamond',
    image: require('@/assets/images/mygems-icon.png'),
    accent: Accent.violet,
    module: 'gems',
    mode: 'photo',
    maxPages: 1,
    href: (uris) => ({
      pathname: '/(marketplace)/gems/add',
      params: { sharedImageUris: JSON.stringify(uris) },
    }) as Href,
  },
  {
    id: 'cheque',
    label: 'Cheque',
    hint: 'Scan → Add cheque',
    icon: 'cheque',
    image: WORKSPACE_ENTITY_IMAGES.cheque,
    accent: Accent.amber,
    module: 'cheques',
    mode: 'document',
    maxPages: 1,
    href: (uris) => ({
      pathname: '/(marketplace)/cheques/add',
      params: { sharedImageUri: uris[0] },
    }) as Href,
  },
  {
    id: 'bill',
    label: 'Bill',
    hint: 'Scan → Add bill',
    icon: 'bill',
    image: WORKSPACE_ENTITY_IMAGES.bill,
    accent: Accent.blue,
    module: 'bills',
    mode: 'document',
    maxPages: 1,
    href: (uris) => ({
      pathname: '/(marketplace)/bills/add',
      params: { sharedReceiptUri: uris[0] },
    }) as Href,
  },
  {
    id: 'receipt',
    label: 'Receipt',
    hint: 'Scan → Transaction',
    icon: 'receipt-long',
    accent: Accent.emerald,
    module: 'money',
    mode: 'document',
    maxPages: 1,
    href: (uris) => ({
      pathname: '/(marketplace)/(tabs)/money/transactions',
      params: { receiptUri: uris[0] },
    }) as Href,
  },
  {
    id: 'passport',
    label: 'Passport',
    hint: 'Scan → New trip',
    icon: 'badge',
    image: WORKSPACE_ENTITY_IMAGES.trip,
    accent: Accent.teal,
    module: 'trips',
    mode: 'document',
    maxPages: 2,
    href: (uris) => ({
      pathname: '/(marketplace)/trips/add',
      params: { scanUris: JSON.stringify(uris), scanKind: 'passport' },
    }) as Href,
  },
];

/** Let a closing sheet finish animating before the camera UI is presented. */
const SHEET_CLOSE_MS = 350;
const TILE_MIN_WIDTH = 66;

/**
 * "Scan & add" tiles: capture a gem photo or scan a cheque, bill, receipt or
 * passport, then open the matching add sheet with the capture attached.
 * `onBeforeCapture` closes the host sheet.
 */
export function ScanToAddRow({
  onBeforeCapture,
  header,
  style,
}: {
  onBeforeCapture?: () => void;
  /** Rendered above the tiles (hidden with them when nothing is available). */
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState<ScanTarget | null>(null);
  const role = resolveProfileRole(profile);
  const targets = user ? TARGETS.filter((t) => canAccessModule(role, t.module)) : [];

  if (targets.length === 0) return null;
  // Fit every target across the sheet; only scroll on very narrow screens.
  const fitted = (width - Spacing.containerMargin * 2 - Spacing.sm * (targets.length - 1)) / targets.length;
  const tileWidth = Math.max(TILE_MIN_WIDTH, Math.floor(fitted));

  async function start(target: TargetConfig) {
    if (pending) return;
    setPending(target.id);
    haptics.selection();
    try {
      if (onBeforeCapture) {
        onBeforeCapture();
        await new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_MS));
      }
      const media =
        target.mode === 'photo'
          ? await capturePhoto().then((m) => (m ? [m] : []))
          : await scanDocuments({ maxPages: target.maxPages });
      if (media.length === 0) return;
      router.push(target.href(media.map((m) => m.uri)));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open the camera.'));
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={style}>
      {header}
      <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {targets.map((target) => {
        const busy = pending === target.id;
        return (
          <Pressable
            key={target.id}
            accessibilityRole="button"
            accessibilityLabel={`Scan ${target.label}`}
            accessibilityHint={target.hint}
            accessibilityState={{ busy, disabled: !!pending }}
            disabled={!!pending}
            onPress={() => void start(target)}
            style={({ pressed }) => [
              styles.tile,
              { width: tileWidth, backgroundColor: colors.surfaceContainerLow },
              pressed && styles.pressed,
              !!pending && !busy && styles.dimmed,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: `${target.accent}1A` }]}>
              {busy ? (
                <ActivityIndicator size="small" color={target.accent} />
              ) : target.image ? (
                <Image
                  source={target.image}
                  style={styles.image}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Icon name={target.icon} size={24} color={target.accent} />
              )}
              <View style={[styles.badge, { backgroundColor: target.accent, borderColor: colors.surfaceContainerLow }]}>
                <Icon
                  name={target.mode === 'photo' ? 'photo-camera' : 'document-scanner'}
                  size={11}
                  color="#FFFFFF"
                />
              </View>
            </View>
            <Text style={[styles.label, { color: colors.onSurface }]} numberOfLines={1}>
              {target.label}
            </Text>
          </Pressable>
        );
      })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, paddingVertical: 2 },
  tile: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  dimmed: { opacity: 0.5 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 32, height: 32 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { includeFontPadding: false, fontFamily: FontFamily.semibold, fontSize: 12 },
});
