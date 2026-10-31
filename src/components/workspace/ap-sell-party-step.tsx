import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Accent, IconBubble } from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { WorkspaceGem } from "@/types";

type ApSellPartyStepProps = {
  /** Large person/money face for this step. */
  partyName: string;
  partyPhotoUrl?: string | null;
  /** Accent icon on the flow arrow (send vs wallet). */
  flowIcon: IconName;
  gemUri?: string | null;
  /** The gem itself — used for its artwork when there is no photo. */
  gem?: WorkspaceGem | null;
  gemLabel: string;
  amount: string;
  onChangeAmount: (value: string) => void;
  currencyLabel: string;
  error?: string;
  /** When true, avatar uses wallet/money chrome instead of a person. */
  moneyTone?: boolean;
};

const FACE = 64;

/**
 * One price beat of the AP sale: gem → flow → party, then one big amount.
 * Amber = the sender's share (owed), emerald = what you keep.
 */
export function ApSellPartyStep({
  partyName,
  partyPhotoUrl,
  flowIcon,
  gemUri,
  gem,
  gemLabel,
  amount,
  onChangeAmount,
  currencyLabel,
  error,
  moneyTone,
}: ApSellPartyStepProps) {
  const { colors } = useAppTheme();
  const accent = moneyTone ? Accent.emerald : Accent.amber;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(280)} style={styles.flowRow}>
        {gemUri || !gem ? (
          <GemThumb uri={gemUri ?? null} label={gemLabel} size={FACE} radius={18} />
        ) : (
          <GemArtwork gem={gem} artScale={0.8} style={styles.artwork} />
        )}

        <View style={styles.flow} pointerEvents="none">
          <View style={[styles.flowLine, { backgroundColor: `${accent}40` }]} />
          <View style={[styles.flowBadge, { backgroundColor: colors.background }]}>
            <IconBubble icon={flowIcon} accent={accent} size={36} />
          </View>
          <View style={styles.flowArrow}>
            <Icon name="chevron-right" size={18} color={accent} />
          </View>
        </View>

        {moneyTone ? (
          <IconBubble icon="account-balance-wallet" accent={accent} size={FACE} />
        ) : (
          <ContactAvatar name={partyName} photoUrl={partyPhotoUrl} size={FACE} />
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(300)}
        style={styles.copy}
      >
        <Text
          style={[styles.partyName, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {partyName}
        </Text>
        <Text
          style={[styles.gemLabel, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {gemLabel}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(300)}
        style={styles.amountBlock}
      >
        <MaskedInput
          mode="currency"
          label={moneyTone ? `You keep (${currencyLabel})` : `To ${partyName} (${currencyLabel})`}
          value={amount}
          onChangeText={onChangeAmount}
          leftIcon="payments"
          error={error}
          accessibilityLabel={`${partyName} amount`}
          style={styles.amountInput}
        />
      </Animated.View>
    </View>
  );
}

/** Compact progress rail: person → wallet → check. */
export function ApSellStepRail({
  step,
}: {
  step: 0 | 1 | 2;
}) {
  const { colors } = useAppTheme();
  const icons: IconName[] = [
    "person",
    "account-balance-wallet",
    "check-circle",
  ];

  return (
    <View
      style={styles.rail}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: icons.length, now: step + 1 }}
    >
      {icons.map((icon, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <View key={icon} style={styles.railItem}>
            {i > 0 ? (
              <View
                style={[
                  styles.railConnector,
                  {
                    backgroundColor:
                      i <= step ? colors.primary : colors.outlineVariant,
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.railDot,
                active
                  ? { backgroundColor: colors.primary }
                  : done
                    ? { backgroundColor: `${colors.primary}1F` }
                    : { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Icon
                name={done ? "check" : icon}
                size={14}
                color={
                  active
                    ? colors.onPrimary
                    : done
                      ? colors.primary
                      : colors.onSurfaceVariant
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  artwork: {
    width: FACE,
    height: FACE,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  flow: {
    width: 96,
    height: FACE,
    alignItems: "center",
    justifyContent: "center",
  },
  flowLine: {
    position: "absolute",
    left: 8,
    right: 8,
    top: FACE / 2 - 1,
    height: 2,
    borderRadius: 1,
  },
  flowBadge: { padding: 3, borderRadius: 24 },
  flowArrow: { position: "absolute", right: 0 },
  copy: { alignItems: "center", gap: 2 },
  partyName: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    includeFontPadding: false,
  },
  gemLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    includeFontPadding: false,
  },
  amountBlock: { width: "100%" },
  amountInput: {
    fontFamily: FontFamily.semibold,
    fontSize: 22,
  },

  rail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  railConnector: {
    width: 32,
    height: 2,
    borderRadius: 1,
  },
  railDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
