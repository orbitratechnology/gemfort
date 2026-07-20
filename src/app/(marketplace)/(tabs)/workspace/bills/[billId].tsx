import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  FormSection,
  FormSectionLabel,
  ScreenInset,
} from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  BILL_DIRECTION_LABELS,
  BILL_STATUS_LABELS,
  dueLabel,
  isOpenBill,
  remainingAmount,
} from "@/features/workspace/bill-utils";
import {
  fetchBill,
  fetchContacts,
  recordBillPayment,
  updateBillStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

export default function BillDetailScreen() {
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showPayForm, setShowPayForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", billId],
    queryFn: () => fetchBill(billId!),
    enabled: !!billId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", bill?.ownerUid],
    queryFn: () => fetchContacts(bill!.ownerUid),
    enabled: !!bill?.ownerUid,
  });

  const contactName =
    contacts.find((c) => c.id === bill?.counterpartyContactId)?.displayName ??
    "—";

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["bills"] });
    await queryClient.invalidateQueries({ queryKey: ["bill", billId] });
    await queryClient.invalidateQueries({ queryKey: ["payments"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }

  async function handleRecordPayment(full?: boolean) {
    if (!user || !bill) return;
    const remaining = remainingAmount(bill);
    const parsed = full
      ? remaining
      : paymentAmount
        ? parseFloat(paymentAmount)
        : remaining;
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setLoading(true);
    try {
      await recordBillPayment(user.uid, bill.id, parsed, {
        currency: bill.currency,
        paymentMethod: paymentMethod || null,
      });
      await invalidate();
      toast.success(
        bill.direction === "receivable" ? "Payment received" : "Payment recorded",
      );
      setShowPayForm(false);
      setPaymentAmount("");
      setPaymentMethod("");
    } catch (e) {
      toast.error(friendlyError(e, "Payment could not be recorded."));
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (!bill) return;
    Alert.alert("Cancel bill", "Mark this bill as cancelled?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await updateBillStatus(bill.id, "cancelled");
            await invalidate();
            toast.success("Bill cancelled");
          } catch (e) {
            toast.error(friendlyError(e, "Could not cancel bill."));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  if (isLoading || !bill) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Bill" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = remainingAmount(bill);
  const isPayable = bill.direction === "payable";
  const open = isOpenBill(bill);
  const commissionHint =
    bill.commissionPercent != null && bill.commissionPercent > 0
      ? `${bill.commissionPercent}% of each payment`
      : null;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Bill Detail" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: isPayable
                  ? colors.errorContainer
                  : colors.primary,
              },
            ]}
          >
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.heroIcon,
                  {
                    backgroundColor: isPayable
                      ? colors.error + "22"
                      : colors.onPrimary + "22",
                  },
                ]}
              >
                <Icon
                  name={isPayable ? "call-made" : "call-received"}
                  size={28}
                  color={isPayable ? colors.error : colors.onPrimary}
                />
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {BILL_STATUS_LABELS[bill.status]}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.heroAmount,
                { color: isPayable ? colors.error : colors.onPrimary },
              ]}
              selectable
            >
              {formatCurrency(remaining, bill.currency)}
            </Text>
            <Text
              style={[
                styles.heroMeta,
                {
                  color: isPayable
                    ? colors.onErrorContainer
                    : colors.onPrimary + "CC",
                },
              ]}
            >
              {BILL_DIRECTION_LABELS[bill.direction]} · {contactName}
            </Text>
            <Text
              style={[
                styles.heroMeta,
                {
                  color: isPayable
                    ? colors.onErrorContainer
                    : colors.onPrimary + "AA",
                },
              ]}
            >
              Due {dueLabel(bill)}
            </Text>
          </View>
        </ScreenInset>

        <FormSection title="Details">
          <DetailRow
            label="Total"
            value={formatCurrency(bill.amount, bill.currency)}
            colors={colors}
          />
          <DetailRow
            label="Settled"
            value={formatCurrency(bill.amountSettled, bill.currency)}
            colors={colors}
          />
          <DetailRow
            label="Remaining"
            value={formatCurrency(remaining, bill.currency)}
            colors={colors}
          />
          <DetailRow label="Due date" value={formatDate(bill.dueDate)} colors={colors} />
          {commissionHint ? (
            <DetailRow label="Commission" value={commissionHint} colors={colors} />
          ) : null}
          {bill.notes ? (
            <DetailRow label="Notes" value={bill.notes} colors={colors} />
          ) : null}
        </FormSection>

        {open ? (
          <>
            <FormSectionLabel title="Record payment" />
            <ScreenInset>
              {showPayForm ? (
                <View style={styles.payForm}>
                  <Input
                    label="Amount"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                    placeholder={String(remaining)}
                    leftIcon="payments"
                  />
                  <Input
                    label="Method"
                    value={paymentMethod}
                    onChangeText={setPaymentMethod}
                    placeholder="Cash, transfer…"
                    leftIcon="account-balance-wallet"
                  />
                  {commissionHint ? (
                    <Text style={[styles.hint, { color: colors.textMuted }]}>
                      Commission {commissionHint} will be stored on the payment
                    </Text>
                  ) : null}
                  <Button
                    title="Confirm"
                    icon="check-circle"
                    loading={loading}
                    onPress={() => handleRecordPayment(false)}
                  />
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setShowPayForm(false)}
                  />
                </View>
              ) : (
                <View style={styles.payActions}>
                  <Button
                    title={
                      isPayable ? "Pay remaining" : "Receive remaining"
                    }
                    icon="check-circle"
                    loading={loading}
                    style={styles.flex1}
                    onPress={() => handleRecordPayment(true)}
                  />
                  <Button
                    title="Partial"
                    variant="secondary"
                    style={styles.flex1}
                    onPress={() => {
                      setPaymentAmount(String(remaining));
                      setShowPayForm(true);
                    }}
                  />
                </View>
              )}
              {!showPayForm ? (
                <Button
                  title="Cancel bill"
                  variant="ghost"
                  icon="cancel"
                  loading={loading}
                  onPress={handleCancel}
                />
              ) : null}
            </ScreenInset>
          </>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: colors.onSurface }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: Spacing.section, gap: Spacing.lg },
  hero: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.labelMd, fontWeight: "600" },
  heroAmount: {
    ...Typography.displayLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  heroMeta: { ...Typography.bodySmall },
  detailRow: { gap: 2 },
  detailLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  detailValue: { ...Typography.bodyMd },
  payForm: { gap: Spacing.sm },
  payActions: { flexDirection: "row", gap: Spacing.sm },
  flex1: { flex: 1 },
  hint: { ...Typography.caption },
});
