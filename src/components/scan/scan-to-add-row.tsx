import type { ImageSource } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { ActionTile, ActionTileGrid } from '@/components/ui/action-tile';
import { Accent } from '@/components/ui/detail-kit';
import type { IconName } from '@/components/ui/icon';
import { canAccessModule, resolveProfileRole, type WorkspaceModule } from '@/constants/roles';
import { WORKSPACE_ENTITY_IMAGES } from '@/constants/workspace-entity-images';
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
export const SHEET_CLOSE_MS = 350;

/**
 * "Scan & add" tiles: capture a gem photo or scan a cheque, bill, receipt or
 * passport, then open the matching add sheet with the capture attached.
 * `onBeforeCapture` closes the host sheet; `trailing` tiles share the row.
 */
export function ScanToAddRow({
  onBeforeCapture,
  trailing,
  style,
}: {
  onBeforeCapture?: () => void;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState<ScanTarget | null>(null);
  const role = resolveProfileRole(profile);
  const targets = user ? TARGETS.filter((t) => canAccessModule(role, t.module)) : [];

  if (targets.length === 0 && !trailing) return null;

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
    <ActionTileGrid style={style}>
      {targets.map((target) => (
        <ScanTile
          key={target.id}
          label={target.label}
          hint={target.hint}
          icon={target.icon}
          image={target.image}
          accent={target.accent}
          busy={pending === target.id}
          disabled={!!pending}
          onPress={() => void start(target)}
        />
      ))}
      {trailing}
    </ActionTileGrid>
  );
}

/** Scan grid tile: an `ActionTile` announced as "Scan <label>". */
export function ScanTile(props: {
  label: string;
  hint: string;
  icon: IconName;
  image?: ImageSource;
  accent: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return <ActionTile {...props} accessibilityLabel={`Scan ${props.label}`} />;
}
