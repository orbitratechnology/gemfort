import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

export type WorkspaceBackdropKind =
  | 'cheques'
  | 'gems'
  | 'trips'
  | 'services'
  | 'ap'
  | 'contacts'
  | 'requests'
  | 'money';

const KIND: Record<
  WorkspaceBackdropKind,
  { icon: IconName; satellites: IconName[] }
> = {
  cheques: {
    icon: 'money-check-dollar',
    satellites: ['money-check-dollar', 'money-check-dollar'],
  },
  gems: { icon: 'diamond', satellites: ['diamond', 'auto-awesome'] },
  trips: { icon: 'flight', satellites: ['public', 'luggage'] },
  services: { icon: 'handyman', satellites: ['build', 'schedule'] },
  ap: { icon: 'handshake', satellites: ['hourglass-empty', 'handshake'] },
  contacts: { icon: 'contacts', satellites: ['group', 'person'] },
  requests: { icon: 'outgoing-mail', satellites: ['inbox', 'send'] },
  money: {
    icon: 'account-balance-wallet',
    satellites: ['payments', 'trending-up'],
  },
};

type Props = { kind: WorkspaceBackdropKind };

/**
 * Atmospheric backdrop anchored to the bottom of the screen so content stays
 * clear up top. Motif plate + watermark icons only — no tint wash (non-interactive).
 */
export function WorkspaceScreenBackdrop({ kind }: Props) {
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const cfg = KIND[kind];

  const ink = isDark ? colors.primary + '22' : colors.primary + '14';
  const line = isDark ? colors.primary + '16' : colors.primary + '12';
  const plate = isDark
    ? colors.surfaceContainerHigh + '99'
    : colors.surfaceContainerLowest + 'E6';
  const plateBorder = isDark
    ? colors.outlineVariant + '55'
    : colors.outlineVariant + 'AA';

  const plateW = Math.min(width * 0.78, 320);
  /** Anchor composition near the bottom (above typical FAB / tab inset). */
  const anchorBottom = 56;
  const plateH = 200;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {/* Bottom-centered motif plate */}
      <View
        style={[
          styles.plateWrap,
          {
            bottom: anchorBottom + 24,
            left: (width - plateW) / 2,
            width: plateW,
            height: plateH,
          },
        ]}
      >
        <MotifPlate
          kind={kind}
          plate={plate}
          plateBorder={plateBorder}
          ink={ink}
          line={line}
        />
      </View>

      {/* Bottom watermark */}
      <View
        style={[
          styles.centerMark,
          {
            bottom: anchorBottom + 72,
            left: (width - 112) / 2,
            opacity: isDark ? 0.16 : 0.12,
          },
        ]}
      >
        <Icon name={cfg.icon} size={112} color={colors.primary} />
      </View>

      {/* Soft satellites around the bottom cluster */}
      <View
        style={[
          styles.mark,
          {
            bottom: anchorBottom + 180,
            left: width * 0.1,
            opacity: isDark ? 0.1 : 0.07,
            transform: [{ rotate: '-16deg' }],
          },
        ]}
      >
        <Icon name={cfg.satellites[0]} size={48} color={colors.primary} />
      </View>
      <View
        style={[
          styles.mark,
          {
            bottom: anchorBottom + 20,
            right: width * 0.08,
            opacity: isDark ? 0.09 : 0.06,
            transform: [{ rotate: '14deg' }],
          },
        ]}
      >
        <Icon name={cfg.satellites[1]} size={56} color={colors.primary} />
      </View>
    </View>
  );
}

function MotifPlate({
  kind,
  plate,
  plateBorder,
  ink,
  line,
}: {
  kind: WorkspaceBackdropKind;
  plate: string;
  plateBorder: string;
  ink: string;
  line: string;
}) {
  if (kind === 'cheques') {
    return (
      <View
        style={[
          styles.slip,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        <View style={[styles.slipStripe, { backgroundColor: ink }]} />
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[styles.slipRule, { borderBottomColor: line, top: 48 + i * 26 }]}
          />
        ))}
        <View style={[styles.micrBar, { backgroundColor: ink }]} />
      </View>
    );
  }

  if (kind === 'gems') {
    return (
      <View style={styles.gemCluster}>
        <View
          style={[
            styles.facet,
            {
              backgroundColor: plate,
              borderColor: plateBorder,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.facetSmall,
            {
              backgroundColor: ink,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </View>
    );
  }

  if (kind === 'trips') {
    return (
      <View style={styles.tripsMotif}>
        <View style={[styles.orbit, { borderColor: line }]} />
        <View style={[styles.orbitInner, { borderColor: ink }]} />
        <View style={[styles.routeDash, { backgroundColor: ink }]} />
      </View>
    );
  }

  if (kind === 'services') {
    return (
      <View
        style={[
          styles.toolBoard,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            style={[styles.toolSlot, { backgroundColor: ink, left: 28 + i * 58 }]}
          />
        ))}
      </View>
    );
  }

  if (kind === 'ap') {
    return (
      <View style={styles.apMotif}>
        <View style={[styles.apCircle, { backgroundColor: plate, borderColor: plateBorder }]} />
        <View
          style={[
            styles.apCircle,
            styles.apCircleRight,
            { backgroundColor: plate, borderColor: plateBorder },
          ]}
        />
      </View>
    );
  }

  if (kind === 'contacts') {
    return (
      <View style={styles.contactsMotif}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.avatarDot,
              {
                backgroundColor: i === 1 ? ink : plate,
                borderColor: plateBorder,
                marginLeft: i === 0 ? 0 : -18,
                zIndex: 3 - i,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (kind === 'requests') {
    return (
      <View
        style={[
          styles.envelope,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        <View style={[styles.envelopeFlap, { borderBottomColor: ink }]} />
      </View>
    );
  }

  // money
  return (
    <View style={styles.moneyStack}>
      <View
        style={[
          styles.walletCard,
          styles.walletBack,
          { backgroundColor: ink, borderColor: plateBorder },
        ]}
      />
      <View
        style={[
          styles.walletCard,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        <View style={[styles.walletChip, { backgroundColor: ink }]} />
      </View>
    </View>
  );
}

/** @deprecated Prefer WorkspaceScreenBackdrop kind="cheques" */
export function ChequeScreenBackdrop() {
  return <WorkspaceScreenBackdrop kind="cheques" />;
}

const styles = StyleSheet.create({
  plateWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMark: {
    position: 'absolute',
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { position: 'absolute' },

  slip: {
    width: '100%',
    height: 200,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-8deg' }],
    overflow: 'hidden',
  },
  slipStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  slipRule: {
    position: 'absolute',
    left: 28,
    right: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  micrBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 18,
    height: 10,
    borderRadius: 2,
    opacity: 0.55,
  },

  gemCluster: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facet: {
    width: 140,
    height: 140,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  facetSmall: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    opacity: 0.7,
  },

  tripsMotif: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  orbitInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  routeDash: {
    position: 'absolute',
    width: 120,
    height: 3,
    borderRadius: 2,
    transform: [{ rotate: '-28deg' }],
  },

  toolBoard: {
    width: '100%',
    height: 120,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-6deg' }],
  },
  toolSlot: {
    position: 'absolute',
    top: 28,
    width: 28,
    height: 64,
    borderRadius: Radius.sm,
    opacity: 0.85,
  },

  apMotif: {
    width: 200,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 40,
  },
  apCircleRight: {
    position: 'absolute',
    right: 10,
    marginRight: 0,
  },

  contactsMotif: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  avatarDot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
  },

  envelope: {
    width: 200,
    height: 140,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    transform: [{ rotate: '-5deg' }],
  },
  envelopeFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderLeftWidth: 100,
    borderRightWidth: 100,
    borderBottomWidth: 70,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  moneyStack: {
    width: 220,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCard: {
    width: 200,
    height: 118,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  walletBack: {
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '8deg' }, { scale: 0.94 }],
  },
  walletChip: {
    width: 36,
    height: 28,
    borderRadius: 6,
    opacity: 0.7,
  },
});
