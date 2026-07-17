import { StyleSheet, Text, View } from "react-native";

import { BankAvatar } from "@/components/workspace/bank-picker-sheet";
import {
    Radius,
    Spacing,
    Typography,
    type ThemeColors,
} from "@/constants/design-tokens";
import { getBankByCode, getBankByName } from "@/constants/sri-lanka-banks";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { ChequeDirection } from "@/types";

type ChequePreviewCardProps = {
  direction: ChequeDirection;
  chequeNumber: string;
  bankName: string;
  bankCode?: string | null;
  branch?: string;
  amount: string;
  issuedBy: string;
  maturityDateLabel: string | null;
};

function formatPreviewAmount(raw: string): string {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return "LKR —";
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return "LKR —";
  return formatCurrency(n, "LKR");
}

function LineField({
  label,
  value,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  placeholder: string;
  colors: ThemeColors;
}) {
  const filled = value.trim().length > 0;
  return (
    <View style={styles.lineField}>
      <Text style={[styles.microLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        selectable={filled}
        style={[
          styles.lineValue,
          {
            color: filled ? colors.onSurface : colors.outline,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
        numberOfLines={1}
      >
        {filled ? value : placeholder}
      </Text>
    </View>
  );
}

/**
 * Live paper-cheque preview for the Add Cheque form.
 * Hierarchy from type and space — bank logo is the brand signal.
 */
export function ChequePreviewCard({
  direction,
  chequeNumber,
  bankName,
  bankCode,
  branch,
  amount,
  issuedBy,
  maturityDateLabel,
}: ChequePreviewCardProps) {
  const { colors } = useAppTheme();
  const isReceived = direction === "received";
  const bank = getBankByCode(bankCode) ?? getBankByName(bankName) ?? null;
  const amountLabel = formatPreviewAmount(amount);
  const amountFilled =
    amount.replace(/,/g, "").trim().length > 0 &&
    Number.isFinite(Number(amount.replace(/,/g, "")));
  const branchLine = branch?.trim() || null;
  const a11yBank = [bankName.trim() || bank?.name, branchLine]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      accessible
      accessibilityLabel={`Cheque preview. ${isReceived ? "Received" : "Given"}. ${a11yBank || "Bank pending"}. ${amountLabel}.`}
    >
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        Preview
      </Text>

      <View
        style={[
          styles.cheque,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.chequeInner}>
          <View style={styles.topRow}>
            <View style={styles.bankBlock}>
              {bank ? (
                <BankAvatar bank={bank} size={48} />
              ) : (
                <View
                  style={[
                    styles.bankPlaceholder,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Text
                    style={[
                      styles.bankPlaceholderText,
                      { color: colors.outline },
                    ]}
                  >
                    Bank
                  </Text>
                </View>
              )}
              <View style={styles.bankText}>
                <Text
                  selectable={!!bankName.trim()}
                  style={[
                    styles.bankName,
                    {
                      color:
                        bankName.trim() || bank
                          ? colors.onSurface
                          : colors.outline,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {bankName.trim() || bank?.name || "Bank"}
                </Text>
                <Text
                  selectable={!!branchLine}
                  style={[styles.branch, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {branchLine ?? (bank?.code ? `Code ${bank.code}` : "Branch")}
                </Text>
              </View>
            </View>

            <View style={styles.metaBlock}>
              <Text
                style={[
                  styles.directionLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {isReceived ? "Received" : "Given"}
              </Text>
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                No.
              </Text>
              <Text
                selectable={!!chequeNumber.trim()}
                style={[
                  styles.chequeNo,
                  {
                    color: chequeNumber.trim()
                      ? colors.onSurface
                      : colors.outline,
                  },
                ]}
                numberOfLines={1}
              >
                {chequeNumber.trim() || "————"}
              </Text>
            </View>
          </View>

          <LineField
            label={isReceived ? "From" : "Pay to"}
            value={issuedBy}
            placeholder="Name on cheque"
            colors={colors}
          />

          <View style={styles.bottomRow}>
            <View
              style={[
                styles.amountBox,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                Amount
              </Text>
              <Text
                selectable={amountFilled}
                style={[
                  styles.amountValue,
                  { color: amountFilled ? colors.onSurface : colors.outline },
                ]}
                numberOfLines={1}
              >
                {amountLabel}
              </Text>
            </View>
            <View style={styles.maturityBlock}>
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                Matures
              </Text>
              <Text
                selectable={!!maturityDateLabel}
                style={[
                  styles.maturityValue,
                  {
                    color: maturityDateLabel
                      ? colors.onSurface
                      : colors.outline,
                  },
                ]}
                numberOfLines={1}
              >
                {maturityDateLabel ?? "—"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: Spacing.stackSm,
    marginHorizontal: Spacing.containerMargin,
  },
  cheque: {
    borderWidth: 1,
    overflow: "hidden",
  },
  chequeInner: {
    padding: Spacing.gutterMd,
    gap: Spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  bankBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  bankPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bankPlaceholderText: { ...Typography.caption, fontWeight: "600" },
  bankText: { flex: 1, minWidth: 0, gap: 2 },
  bankName: { ...Typography.bodyLg, fontWeight: "700" },
  branch: { ...Typography.caption },
  metaBlock: { alignItems: "flex-end", maxWidth: "36%", gap: 2 },
  directionLabel: { ...Typography.caption, fontWeight: "600" },
  microLabel: {
    ...Typography.caption,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chequeNo: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  lineField: { gap: 4 },
  lineValue: {
    ...Typography.bodyLg,
    fontWeight: "500",
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  amountBox: {
    flex: 1.5,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  amountValue: {
    ...Typography.headlineMdMobile,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  maturityBlock: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  maturityValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
  },
});
