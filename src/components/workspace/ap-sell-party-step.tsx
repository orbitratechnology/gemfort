import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type ApSellPartyStepProps = {
  /** Large person/money face for this step. */
  partyName: string;
  partyPhotoUrl?: string | null;
  /** Accent icon on the flow arrow (send vs wallet). */
  flowIcon: IconName;
  gemUri?: string | null;
  gemLabel: string;
  amount: string;
  onChangeAmount: (value: string) => void;
  currencyLabel: string;
  error?: string;
  /** When true, avatar uses wallet/money chrome instead of a person. */
  moneyTone?: boolean;
};

/**
 * One full-screen price beat: gem → flow arrow → party face → one big amount.
 * No instructional copy — layout and icons carry the meaning.
 */
export function ApSellPartyStep({
  partyName,
  partyPhotoUrl,
  flowIcon,
  gemUri,
  gemLabel,
  amount,
  onChangeAmount,
  currencyLabel,
  error,
  moneyTone,
}: ApSellPartyStepProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.root}>
      <Animated.View
        entering={FadeIn.duration(280)}
        style={styles.gemBlock}
      >
        <GemThumb uri={gemUri ?? null} label={gemLabel} size={72} radius={16} />
        <Text
          style={[styles.gemLabel, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {gemLabel}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(40).duration(280)}
        style={styles.flow}
        pointerEvents="none"
      >
        <View
          style={[
            styles.flowLine,
            { backgroundColor: colors.outlineVariant },
          ]}
        />
        <View
          style={[
            styles.flowBadge,
            {
              backgroundColor: moneyTone
                ? colors.successEmerald + "22"
                : colors.primaryContainer,
              borderColor: colors.background,
            },
          ]}
        >
          <Icon
            name={flowIcon}
            size={22}
            color={
              moneyTone ? colors.successEmerald : colors.onPrimaryContainer
            }
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(80).duration(300)}
        style={styles.partyBlock}
      >
        {moneyTone ? (
          <View
            style={[
              styles.moneyAvatar,
              { backgroundColor: colors.successEmerald + "22" },
            ]}
          >
            <Icon
              name="account-balance-wallet"
              size={44}
              color={colors.successEmerald}
            />
          </View>
        ) : (
          <ContactAvatar
            name={partyName}
            photoUrl={partyPhotoUrl}
            size={96}
          />
        )}
        <Text
          style={[styles.partyName, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {partyName}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(300)}
        style={styles.amountBlock}
      >
        <Text style={[styles.currencyTag, { color: colors.textMuted }]}>
          {currencyLabel}
        </Text>
        <MaskedInput
          mode="currency"
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
    <View style={styles.rail} accessibilityRole="progressbar">
      {icons.map((icon, i) => {
        const active = i === step;
        const done = i < step;
        const tone = active || done ? colors.primary : colors.outlineVariant;
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
                {
                  backgroundColor: active || done ? colors.primary : colors.surfaceContainerHighest,
                  borderColor: colors.background,
                },
              ]}
            >
              <Icon
                name={icon}
                size={14}
                color={active || done ? colors.onPrimary : tone}
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
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.sm,
  },
  gemBlock: { alignItems: "center", gap: 8 },
  gemLabel: {
    ...Typography.labelMd,
    fontWeight: "700",
    maxWidth: 220,
    textAlign: "center",
  },
  flow: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    width: 80,
  },
  flowLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
  },
  flowBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  partyBlock: { alignItems: "center", gap: 10, maxWidth: "85%" },
  partyName: {
    ...Typography.headlineSm,
    fontWeight: "700",
    textAlign: "center",
  },
  moneyAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  amountBlock: {
    width: "100%",
    gap: 6,
    marginTop: Spacing.sm,
  },
  currencyTag: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  amountInput: {
    ...Typography.displayLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    fontSize: 28,
  },

  rail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: 0,
  },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  railConnector: {
    width: 28,
    height: 2,
    borderRadius: 1,
  },
  railDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
