import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  apAgreedTotal,
  apOwnerOwedTotal,
  apStatusLabel,
  isApOngoing,
} from "@/features/workspace/ap-normalize";
import {
  apPaymentReceived,
  apPaymentSent,
  cancelApRequest,
  fetchApRecordsForUser,
  recordApGemSale,
  respondApRequest,
  returnApGem,
} from "@/features/workspace/ap-lifecycle-service";
import { isApOverdue } from "@/features/workspace/ap-utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatRelativeDue, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { ApGemLine, ApPaymentMethod } from "@/types";

const PAY_METHODS: { id: ApPaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "transfer", label: "Transfer" },
  { id: "cheque", label: "Cheque" },
];

export default function ApDetailScreen() {
  const { apId } = useLocalSearchParams<{ apId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [sellGemId, setSellGemId] = useState<string | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [soldToName, setSoldToName] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("14");
  const [payMethod, setPayMethod] = useState<ApPaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ap", "detail", user?.uid],
    queryFn: () => fetchApRecordsForUser(user!.uid),
    enabled: !!user,
  });

  const ap = records.find((r) => r.id === apId);
  const isSender = !!user && !!ap && ap.senderUid === user.uid;
  const isReceiver = !!user && !!ap && ap.receiverUid === user.uid;

  const owed = useMemo(() => (ap ? apOwnerOwedTotal(ap) : 0), [ap]);
  const currency = ap?.items?.[0]?.currency || ap?.currency || "LKR";

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["ap"] });
    await queryClient.invalidateQueries({ queryKey: ["gems"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["money"] });
  }

  async function run(action: () => Promise<unknown>, ok: string) {
    setLoading(true);
    try {
      await action();
      toast.success(ok);
      await invalidate();
      setSellGemId(null);
      setSoldPrice("");
      setSoldToName("");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update AP."));
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !ap) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="AP detail" />
        <Text style={[styles.loading, { color: colors.textMuted }]}>
          {isLoading ? "Loading…" : "AP not found."}
        </Text>
      </SafeAreaView>
    );
  }

  const overdue = isApOverdue(ap);
  const partyLabel = isSender
    ? `To ${ap.receiverName}`
    : `From ${ap.senderName}`;

  function lineCommission(line: ApGemLine, sale: number) {
    return sale - line.agreedPrice;
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="AP detail" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSection title="Overview">
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {partyLabel}
          </Text>
          <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>
            {apStatusLabel(ap.status)}
            {overdue ? " · Overdue" : ""}
            {" · "}
            {formatCurrency(apAgreedTotal(ap), currency)} agreed
          </Text>
          {ap.dateGiven ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Given {formatRelativeTime(ap.dateGiven)}
              {ap.expectedReturnDate
                ? ` · Return ${formatRelativeDue(ap.expectedReturnDate)}`
                : ""}
            </Text>
          ) : (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Requested {formatRelativeTime(ap.createdAt)}
            </Text>
          )}
          {ap.rejectionReason ? (
            <Text style={[styles.meta, { color: colors.error }]}>
              Reason: {ap.rejectionReason}
            </Text>
          ) : null}
        </FormSection>

        <FormSection title="Gems">
          {(ap.items ?? []).map((line) => {
            const selling = sellGemId === line.gemId;
            return (
              <View
                key={line.gemId}
                style={[
                  styles.lineCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.lineTop}>
                  <Text
                    style={[styles.lineTitle, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {line.gemLabel}
                  </Text>
                  <Text
                    style={[
                      styles.lineStatus,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {line.lineStatus}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  AP {formatCurrency(line.agreedPrice, line.currency)}
                  {line.soldPrice != null
                    ? ` · Sold ${formatCurrency(line.soldPrice, line.currency)}`
                    : ""}
                  {line.commission != null
                    ? ` · Comm ${formatCurrency(line.commission, line.currency)}`
                    : ""}
                </Text>

                {isReceiver &&
                isApOngoing(ap.status) &&
                line.lineStatus === "held" ? (
                  <View style={styles.row}>
                    <Button
                      title="Sell"
                      onPress={() => {
                        setSellGemId(line.gemId);
                        setSoldPrice("");
                        setSoldToName("");
                      }}
                      style={styles.flex}
                    />
                    <Button
                      title="Return"
                      variant="secondary"
                      loading={loading}
                      onPress={() =>
                        run(
                          () => returnApGem(ap.id, line.gemId),
                          "Gem returned",
                        )
                      }
                      style={styles.flex}
                    />
                  </View>
                ) : null}

                {selling ? (
                  <View style={styles.sellBox}>
                    <Input
                      label="Sold price"
                      value={soldPrice}
                      onChangeText={setSoldPrice}
                      keyboardType="decimal-pad"
                      leftIcon="payments"
                    />
                    <Input
                      label="Sold to"
                      value={soldToName}
                      onChangeText={setSoldToName}
                      leftIcon="person"
                    />
                    <Input
                      label="Payment due (days)"
                      value={paymentDueDays}
                      onChangeText={setPaymentDueDays}
                      keyboardType="number-pad"
                      leftIcon="schedule"
                    />
                    {soldPrice.trim() ? (
                      <Text style={{ color: colors.textMuted }}>
                        Commission{" "}
                        {formatCurrency(
                          lineCommission(line, parseFloat(soldPrice) || 0),
                          line.currency,
                        )}
                      </Text>
                    ) : null}
                    <View style={styles.row}>
                      <Button
                        title="Cancel"
                        variant="secondary"
                        onPress={() => setSellGemId(null)}
                        style={styles.flex}
                      />
                      <Button
                        title="Confirm sale"
                        loading={loading}
                        onPress={() => {
                          const price = parseFloat(soldPrice);
                          if (!price || Number.isNaN(price)) {
                            toast.error("Enter sale price");
                            return;
                          }
                          const days = parseInt(paymentDueDays, 10) || 14;
                          const due = new Date();
                          due.setDate(due.getDate() + days);
                          run(
                            () =>
                              recordApGemSale({
                                apId: ap.id,
                                gemId: line.gemId,
                                soldPrice: price,
                                soldToName: soldToName.trim() || undefined,
                                paymentDueDateIso: due.toISOString(),
                              }),
                            "Sale recorded",
                          );
                        }}
                        style={styles.flex}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </FormSection>

        {/* Sender: cancel pending */}
        {isSender && ap.status === "pending" ? (
          <ScreenInset>
            <Button
              title="Cancel request"
              variant="secondary"
              loading={loading}
              onPress={() =>
                run(async () => {
                  await cancelApRequest(ap.id);
                  router.back();
                }, "AP cancelled")
              }
            />
          </ScreenInset>
        ) : null}

        {/* Receiver: accept / reject */}
        {isReceiver && ap.status === "pending" ? (
          <ScreenInset style={styles.row}>
            <Button
              title="Accept"
              loading={loading}
              onPress={() =>
                run(() => respondApRequest(ap.id, "accepted"), "AP accepted")
              }
              style={styles.flex}
            />
            <Button
              title="Reject"
              variant="secondary"
              loading={loading}
              onPress={() =>
                run(async () => {
                  await respondApRequest(ap.id, "rejected");
                  router.back();
                }, "AP rejected")
              }
              style={styles.flex}
            />
          </ScreenInset>
        ) : null}

        {/* Receiver: payment sent after sells */}
        {isReceiver &&
        isApOngoing(ap.status) &&
        (ap.items ?? []).some((i) => i.lineStatus === "sold") ? (
          <FormSection title="Payment to owner">
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Owed {formatCurrency(owed, currency)}
            </Text>
            <View style={styles.methodRow}>
              {PAY_METHODS.map((m) => {
                const active = payMethod === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setPayMethod(m.id)}
                    style={[
                      styles.methodChip,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.surfaceContainerLowest,
                        borderColor: active
                          ? colors.primary
                          : colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.onPrimary : colors.onSurface,
                        fontWeight: "600",
                      }}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              label="Amount"
              value={payAmount || String(owed || "")}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              leftIcon="payments"
            />
            <Button
              title="Payment Sent"
              loading={loading}
              onPress={() => {
                const amount = parseFloat(payAmount || String(owed));
                if (!amount || Number.isNaN(amount)) {
                  toast.error("Enter payment amount");
                  return;
                }
                run(
                  () =>
                    apPaymentSent({
                      apId: ap.id,
                      method: payMethod,
                      amount,
                    }),
                  "Payment marked sent",
                );
              }}
            />
          </FormSection>
        ) : null}

        {/* Sender: confirm payment received */}
        {isSender && ap.status === "payment_sent" ? (
          <FormSection title="Confirm payment">
            <Text style={[styles.meta, { color: colors.onSurface }]}>
              {ap.paymentMethod
                ? ap.paymentMethod.charAt(0).toUpperCase() +
                  ap.paymentMethod.slice(1)
                : "Payment"}{" "}
              · {formatCurrency(ap.paymentAmount ?? owed, currency)}
            </Text>
            <Button
              title="Payment Received"
              loading={loading}
              onPress={() =>
                run(() => apPaymentReceived(ap.id), "Payment confirmed — done")
              }
            />
          </FormSection>
        ) : null}

        {ap.status === "done" ? (
          <FormSection title="Settled">
            <Text style={{ color: colors.textMuted }}>
              Payment received. Money ledgers updated on both sides.
            </Text>
          </FormSection>
        ) : null}

        {isSender && isApOngoing(ap.status) ? (
          <FormSection title="Waiting">
            <View style={styles.waitRow}>
              <Icon name="schedule" size={18} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, flex: 1 }}>
                Holder can sell or return gems. You confirm payment when they
                mark it sent.
              </Text>
            </View>
          </FormSection>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  content: { gap: Spacing.sectionGap, paddingBottom: 100 },
  title: { ...Typography.headlineSm, fontWeight: "700" },
  meta: { ...Typography.bodyMd, marginTop: 4 },
  lineCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  lineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  lineTitle: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  lineStatus: { ...Typography.caption, textTransform: "capitalize" },
  row: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
  flex: { flex: 1 },
  sellBox: { gap: Spacing.sm, marginTop: Spacing.sm },
  methodRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  waitRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
});
