import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type MoneyTone = "sold" | "sender" | "yours";

type ApGemSaleSplitProps = {
  soldLabel: string;
  senderLabel: string;
  yoursLabel: string;
};

const TONE: Record<
  MoneyTone,
  { icon: IconName; bgKey: "primaryContainer" | "secondaryContainer" | "success" }
> = {
  sold: { icon: "sell", bgKey: "secondaryContainer" },
  sender: { icon: "call-made", bgKey: "primaryContainer" },
  yours: { icon: "account-balance-wallet", bgKey: "success" },
};

function toneColors(
  colors: ReturnType<typeof useAppTheme>["colors"],
  bgKey: (typeof TONE)[MoneyTone]["bgKey"],
) {
  if (bgKey === "success") {
    return {
      bg: colors.successEmerald + "22",
      fg: colors.successEmerald,
      iconBg: colors.successEmerald + "33",
    };
  }
  if (bgKey === "primaryContainer") {
    return {
      bg: colors.primaryContainer,
      fg: colors.onPrimaryContainer,
      iconBg: colors.surfaceContainerLowest + "88",
    };
  }
  return {
    bg: colors.secondaryContainer,
    fg: colors.onSecondaryContainer,
    iconBg: colors.surfaceContainerLowest + "88",
  };
}

/**
 * Receiver view: three visual money cells — actual sale, to sender, yours.
 */
export function ApGemSaleSplit({
  soldLabel,
  senderLabel,
  yoursLabel,
}: ApGemSaleSplitProps) {
  const { colors } = useAppTheme();

  const cells: { tone: MoneyTone; amount: string }[] = [
    { tone: "sold", amount: soldLabel },
    { tone: "sender", amount: senderLabel },
    { tone: "yours", amount: yoursLabel },
  ];

  return (
    <View
      style={styles.row}
      accessibilityLabel={`Sold ${soldLabel}, to sender ${senderLabel}, yours ${yoursLabel}`}
    >
      {cells.map((cell) => {
        const meta = TONE[cell.tone];
        const tone = toneColors(colors, meta.bgKey);
        return (
          <View
            key={cell.tone}
            style={[styles.cell, { backgroundColor: tone.bg }]}
          >
            <View
              style={[styles.iconWrap, { backgroundColor: tone.iconBg }]}
            >
              <Icon name={meta.icon} size={16} color={tone.fg} />
            </View>
            <Text
              style={[styles.amount, { color: tone.fg }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {cell.amount}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Sender view: only the amount the receiver owes / sends to them.
 */
export function ApGemSenderDue({ amountLabel }: { amountLabel: string }) {
  const { colors } = useAppTheme();
  const tone = toneColors(colors, "primaryContainer");

  return (
    <View
      style={[styles.dueCard, { backgroundColor: tone.bg }]}
      accessibilityLabel={`Amount to you ${amountLabel}`}
    >
      <View style={[styles.dueIcon, { backgroundColor: tone.iconBg }]}>
        <Icon name="call-received" size={22} color={tone.fg} />
      </View>
      <Text
        style={[styles.dueAmount, { color: tone.fg }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {amountLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    minWidth: 0,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    width: "100%",
  },
  dueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  dueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dueAmount: {
    ...Typography.headlineSm,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flex: 1,
  },
});
