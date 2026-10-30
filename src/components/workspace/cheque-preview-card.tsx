import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Accent } from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { BankAvatar } from "@/components/workspace/bank-picker-sheet";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { getBankByCode, getBankByName } from "@/constants/sri-lanka-banks";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { ChequeDirection, ChequeStatus } from "@/types";

/**
 * One hue per cheque state, shared by the cheque list, calendar and detail:
 * amber = holding (pending), blue = deposited, emerald = cleared,
 * rose = bounced, slate = replaced / cancelled.
 */
export const CHEQUE_STATUS_ACCENT: Record<ChequeStatus, string> = {
  holding: Accent.amber,
  deposited: Accent.blue,
  cleared: Accent.emerald,
  bounced: Accent.rose,
  replaced: Accent.slate,
  cancelled: Accent.slate,
};

export const CHEQUE_STATUS_ICON: Record<ChequeStatus, IconName> = {
  holding: "schedule",
  deposited: "account-balance",
  cleared: "check-circle",
  bounced: "error-outline",
  replaced: "swap-horiz",
  cancelled: "cancel",
};

type ChequePreviewCardProps = {
  direction: ChequeDirection;
  chequeNumber: string;
  bankName: string;
  bankCode?: string | null;
  branch?: string | null;
  /** Raw amount as typed (formatted with `currency`). */
  amount: string;
  /** Currency for the raw amount. Defaults to LKR. */
  currency?: string;
  /** Pre-formatted amount; overrides `amount` + `currency`. */
  amountLabel?: string;
  issuedBy: string;
  maturityDateLabel: string | null;
  /** Stripe + direction tint. Defaults to the holding (amber) accent. */
  accent?: string;
  /** Small eyebrow above the cheque (e.g. "Preview"). */
  label?: string | null;
  /** Shows the cheque's status in place of the Given/Taken pill (lists). */
  status?: { label: string; icon: IconName } | null;
  /** Relative maturity under the date, e.g. "In 5 days". */
  maturityHint?: string | null;
  /** Softer shadow for cards stacked in a list. */
  variant?: "hero" | "list";
  style?: StyleProp<ViewStyle>;
};

function formatPreviewAmount(raw: string, currency: string): string {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return `${currency} —`;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return `${currency} —`;
  return formatCurrency(n, currency);
}

/**
 * Paper-cheque visual: the live preview on Add Cheque and the hero of the
 * cheque detail screen. Hierarchy from type and space — the bank logo is the
 * brand signal, a thin accent stripe carries the cheque's state.
 */
export function ChequePreviewCard({
  direction,
  chequeNumber,
  bankName,
  bankCode,
  branch,
  amount,
  currency = "LKR",
  amountLabel: amountLabelProp,
  issuedBy,
  maturityDateLabel,
  accent = CHEQUE_STATUS_ACCENT.holding,
  label,
  status,
  maturityHint,
  variant = "hero",
  style,
}: ChequePreviewCardProps) {
  const { colors, isDark } = useAppTheme();
  const isReceived = direction === "received";
  const bank = getBankByCode(bankCode) ?? getBankByName(bankName) ?? null;
  const cleanedAmount = amount.replace(/,/g, "").trim();
  const amountFilled =
    !!amountLabelProp ||
    (cleanedAmount.length > 0 && Number.isFinite(Number(cleanedAmount)));
  const amountLabel = amountLabelProp ?? formatPreviewAmount(amount, currency);
  const branchLine = branch?.trim() || null;
  const bankLabel = bankName.trim() || bank?.name || "";
  const a11yBank = [bankLabel, branchLine].filter(Boolean).join(", ");
  const nameFilled = issuedBy.trim().length > 0;

  return (
    <View
      style={style}
      accessible
      accessibilityLabel={`${label ? "Cheque preview" : "Cheque"}. ${isReceived ? "Taken" : "Given"}. ${a11yBank || "Bank pending"}. ${amountLabel}.`}
    >
      {label ? (
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.cheque,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            boxShadow:
              variant === "list"
                ? isDark
                  ? "0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)"
                  : "0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.06)"
                : isDark
                  ? "0 10px 28px rgba(0, 0, 0, 0.35)"
                  : "0 10px 28px rgba(15, 23, 42, 0.10)",
          },
        ]}
      >
        <View style={[styles.stripe, { backgroundColor: accent }]} />

        <View style={styles.inner}>
          <View style={styles.topRow}>
            <View style={styles.bankBlock}>
              {bank ? (
                <BankAvatar bank={bank} size={40} />
              ) : (
                <View
                  style={[
                    styles.bankPlaceholder,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Icon
                    name="account-balance"
                    size={20}
                    color={colors.outline}
                  />
                </View>
              )}
              <View style={styles.bankText}>
                <Text
                  style={[
                    styles.bankName,
                    { color: bankLabel ? colors.onSurface : colors.outline },
                  ]}
                  numberOfLines={1}
                >
                  {bankLabel || "Bank"}
                </Text>
                <Text
                  style={[styles.branch, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {branchLine ?? (bank?.code ? `Code ${bank.code}` : "Branch")}
                </Text>
              </View>
            </View>

            <View style={styles.metaBlock}>
              <View
                style={[styles.directionPill, { backgroundColor: `${accent}1A` }]}
              >
                <Icon
                  name={status?.icon ?? (isReceived ? "call-received" : "call-made")}
                  size={12}
                  color={accent}
                />
                <Text style={[styles.directionText, { color: accent }]}>
                  {status?.label ?? (isReceived ? "Taken" : "Given")}
                </Text>
              </View>
              <Text
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
                <Text style={[styles.chequeNoLabel, { color: colors.textMuted }]}>
                  No.{" "}
                </Text>
                {chequeNumber.trim() || "——————"}
              </Text>
            </View>
          </View>

          <View style={styles.lineField}>
            <Text style={[styles.microLabel, { color: colors.textMuted }]}>
              {isReceived ? "From" : "Pay to"}
            </Text>
            <Text
              style={[
                styles.lineValue,
                {
                  color: nameFilled ? colors.onSurface : colors.outline,
                  borderBottomColor: colors.outlineVariant,
                },
              ]}
              numberOfLines={1}
            >
              {nameFilled ? issuedBy : "Name on cheque"}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View
              style={[
                styles.amountBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                Amount
              </Text>
              <Text
                style={[
                  styles.amountValue,
                  { color: amountFilled ? colors.onSurface : colors.outline },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {amountLabel}
              </Text>
            </View>
            <View style={styles.maturityBlock}>
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                Matures
              </Text>
              <Text
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
              {maturityHint ? (
                <Text style={[styles.maturityHint, { color: accent }]} numberOfLines={1}>
                  {maturityHint}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  eyebrow: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  cheque: {
    borderRadius: Radius.xl + 4,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  stripe: { height: 4 },
  inner: {
    paddingHorizontal: Spacing.gutterMd,
    paddingTop: 14,
    paddingBottom: Spacing.gutterMd,
    gap: 14,
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
    gap: 10,
    minWidth: 0,
  },
  bankPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  bankText: { flex: 1, minWidth: 0, gap: 1 },
  bankName: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  branch: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  metaBlock: { alignItems: "flex-end", maxWidth: "40%", gap: 6 },
  directionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  directionText: { ...text, fontFamily: FontFamily.semibold, fontSize: 11 },
  chequeNo: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  chequeNoLabel: { fontFamily: FontFamily.regular, fontSize: 12 },
  microLabel: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  lineField: { gap: 4 },
  lineValue: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
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
    minWidth: 0,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  amountValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  maturityBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 4,
  },
  maturityValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  maturityHint: { ...text, fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },
});
