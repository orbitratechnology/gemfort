import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SHEET_CLOSE_MS } from '@/components/scan/scan-to-add-row';
import { ActionTile, ActionTileGrid } from '@/components/ui/action-tile';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Accent } from '@/components/ui/detail-kit';
import type { IconName } from '@/components/ui/icon';
import { canAccessModule, resolveProfileRole, type WorkspaceModule } from '@/constants/roles';
import { Spacing, Typography } from '@/constants/design-tokens';
import { WORKSPACE_ENTITY_IMAGES } from '@/constants/workspace-entity-images';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { scanDocuments } from '@/lib/scan';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

const MONEY = '/(marketplace)/(tabs)/money';

type Action = {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  image?: number | (typeof WORKSPACE_ENTITY_IMAGES)[keyof typeof WORKSPACE_ENTITY_IMAGES];
  accent: string;
  module?: WorkspaceModule;
  href: Href;
};

type ScanAction = Omit<Action, 'href'> & { href: (uri: string) => Href };

const RECORD: Action[] = [
  {
    key: 'sale',
    label: 'Sale',
    hint: 'Sell a stone from stock to a trader or contact',
    icon: 'price-check',
    image: require('@/assets/images/mygems-icon.png'),
    accent: Accent.emerald,
    module: 'gems',
    href: '/(marketplace)/money/record-sale' as Href,
  },
  {
    key: 'income',
    label: 'Income',
    hint: 'Commission, service fee or other money in',
    icon: 'south-west',
    accent: Accent.emerald,
    href: { pathname: `${MONEY}/transactions`, params: { compose: 'income' } } as Href,
  },
  {
    key: 'expense',
    label: 'Expense',
    hint: 'Cutting, transport, broker fee or other cost',
    icon: 'north-east',
    accent: Accent.amber,
    href: { pathname: `${MONEY}/transactions`, params: { compose: 'expense' } } as Href,
  },
];

const TRACK: Action[] = [
  {
    key: 'receivable',
    label: 'To collect',
    hint: 'Money a buyer owes you, with a due date',
    icon: 'savings',
    accent: Accent.emerald,
    href: '/(marketplace)/money/receivables/add' as Href,
  },
  {
    key: 'payable',
    label: 'To pay',
    hint: 'Money you owe a supplier, with a due date',
    icon: 'account-balance-wallet',
    accent: Accent.amber,
    href: '/(marketplace)/money/payables/add' as Href,
  },
  {
    key: 'cheque',
    label: 'Cheque',
    hint: 'A post-dated cheque you received or gave',
    icon: 'cheque',
    image: WORKSPACE_ENTITY_IMAGES.cheque,
    accent: Accent.amber,
    module: 'cheques',
    href: '/(marketplace)/cheques/add' as Href,
  },
];

const BILL: Action[] = [
  {
    key: 'bill',
    label: 'Bill',
    hint: 'A bill for cutting, heating or other work',
    icon: 'bill',
    image: WORKSPACE_ENTITY_IMAGES.bill,
    accent: Accent.blue,
    module: 'bills',
    href: '/(marketplace)/bills/add' as Href,
  },
];

const SCAN: ScanAction[] = [
  {
    key: 'scan-receipt',
    label: 'Scan receipt',
    hint: 'Scan a receipt into a new expense',
    icon: 'receipt-long',
    accent: Accent.teal,
    href: (uri) => ({ pathname: `${MONEY}/transactions`, params: { receiptUri: uri } }) as Href,
  },
  {
    key: 'scan-cheque',
    label: 'Scan cheque',
    hint: 'Scan a cheque and fill in its details',
    icon: 'document-scanner',
    accent: Accent.teal,
    module: 'cheques',
    href: (uri) => ({ pathname: '/(marketplace)/cheques/add', params: { sharedImageUri: uri } }) as Href,
  },
];

const GO_TO: Action[] = [
  {
    key: 'transactions',
    label: 'Ledger',
    hint: 'Every income and expense entry',
    icon: 'receipt-long',
    accent: Accent.slate,
    href: `${MONEY}/transactions` as Href,
  },
  {
    key: 'payments',
    label: 'Payments',
    hint: 'Payments against receivables, payables and bills',
    icon: 'payments',
    accent: Accent.slate,
    href: `${MONEY}/payments` as Href,
  },
  {
    key: 'reports',
    label: 'Reports',
    hint: 'Profit & loss, cash flow and stock PDFs',
    icon: 'picture-as-pdf',
    accent: Accent.slate,
    href: `${MONEY}/reports` as Href,
  },
];

/**
 * Everything you can add or open from Money, in one sheet: record a sale or
 * an entry, track what's owed and post-dated cheques, scan paperwork, or jump
 * to the ledger and reports. Each action closes the sheet first so the next
 * screen or camera opens cleanly.
 */
export function MoneyActionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const [scanning, setScanning] = useState<string | null>(null);
  const role = resolveProfileRole(profile);
  const allowed = <T extends { module?: WorkspaceModule }>(items: T[]) =>
    items.filter((item) => !item.module || canAccessModule(role, item.module));

  function open(href: Href) {
    onClose();
    // Let the sheet finish dismissing before the next screen opens.
    setTimeout(() => router.push(href), SHEET_CLOSE_MS);
  }

  async function scan(action: ScanAction) {
    if (scanning) return;
    setScanning(action.key);
    haptics.selection();
    try {
      onClose();
      await new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_MS));
      const pages = await scanDocuments({ maxPages: 1 });
      if (pages[0]) router.push(action.href(pages[0].uri));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open the camera.'));
    } finally {
      setScanning(null);
    }
  }

  const tile = (
    action: Action | ScanAction,
    onPress: () => void,
    extra?: { accessibilityLabel?: string; busy?: boolean; disabled?: boolean },
  ) => (
    <ActionTile
      key={action.key}
      label={action.label}
      hint={action.hint}
      icon={action.icon}
      image={action.image}
      accent={action.accent}
      onPress={onPress}
      {...extra}
    />
  );

  const sections: { title: string; tiles: ReactNode[] }[] = [
    { title: 'Record', tiles: allowed(RECORD).map((a) => tile(a, () => open(a.href))) },
    { title: 'Owed & cheques', tiles: allowed(TRACK).map((a) => tile(a, () => open(a.href))) },
    {
      title: 'Paperwork',
      tiles: [
        ...allowed(BILL).map((a) => tile(a, () => open(a.href))),
        ...allowed(SCAN).map((a) =>
        tile(a, () => void scan(a), {
          accessibilityLabel: a.label,
          busy: scanning === a.key,
          disabled: !!scanning,
        }),
        ),
      ],
    },
    { title: 'Go to', tiles: GO_TO.map((a) => tile(a, () => open(a.href))) },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Money actions" fitToContents>
      {sections
        .filter((section) => section.tiles.length > 0)
        .map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{section.title}</Text>
            <ActionTileGrid>{section.tiles}</ActionTileGrid>
          </View>
        ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
