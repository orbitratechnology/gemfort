import { StyleSheet, Text, View } from "react-native";

import { Accent, Callout, IconBubble } from "@/components/ui/detail-kit";
import type { IconName } from "@/components/ui/icon";
import { FontFamily, Radius } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type ApGemSaleSplitProps = {
  soldLabel: string;
  senderLabel: string;
  yoursLabel: string;
};

/**
 * Receiver view: how one sold gem's money splits — sale price (blue, info),
 * owed to the sender (amber, due) and your share (emerald, gain).
 */
export function ApGemSaleSplit({
  soldLabel,
  senderLabel,
  yoursLabel,
}: ApGemSaleSplitProps) {
  const { colors } = useAppTheme();

  const cells: { key: string; label: string; icon: IconName; accent: string; amount: string }[] = [
    { key: "sold", label: "Sold for", icon: "sell", accent: Accent.blue, amount: soldLabel },
    { key: "sender", label: "To sender", icon: "call-made", accent: Accent.amber, amount: senderLabel },
    {
      key: "yours",
      label: "Yours",
      icon: "account-balance-wallet",
      accent: Accent.emerald,
      amount: yoursLabel,
    },
  ];

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Sold ${soldLabel}, to sender ${senderLabel}, yours ${yoursLabel}`}
    >
      {cells.map((cell) => (
        <View
          key={cell.key}
          style={[styles.cell, { backgroundColor: `${cell.accent}12` }]}
        >
          <IconBubble icon={cell.icon} accent={cell.accent} size={28} />
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {cell.label}
          </Text>
          <Text
            style={[styles.amount, { color: cell.key === "yours" ? cell.accent : colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {cell.amount}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Sender view: only the amount the holder owes for this sold gem.
 */
export function ApGemSenderDue({ amountLabel }: { amountLabel: string }) {
  return (
    <View accessible accessibilityLabel={`Amount to you ${amountLabel}`}>
      <Callout
        icon="call-received"
        accent={Accent.amber}
        label="Due to you"
        value={amountLabel}
        style={styles.callout}
      />
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
    minWidth: 0,
    gap: 4,
    padding: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    includeFontPadding: false,
  },
  amount: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  callout: { marginTop: 0 },
});
