import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ChipSelect } from "@/components/ui/chip-select";
import {
  FormSection,
  FormSectionLabel,
  ScreenInset,
} from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
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
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { fetchGem } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import {
  formatCurrency,
  formatRelativeDue,
  formatRelativeTime,
} from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { ApGemLine, ApPaymentMethod } from "@/types";
import { GemThumb } from "@/components/workspace/gem-thumb";

const PAY_METHODS: {
  value: ApPaymentMethod;
  label: string;
  icon: "payments" | "account-balance" | "money-check-dollar";
}[] = [
  { value: "cash", label: "Cash", icon: "payments" },
  { value: "transfer", label: "Transfer", icon: "account-balance" },
  { value: "cheque", label: "Cheque", icon: "money-check-dollar" },
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
  const [receiveMethod, setReceiveMethod] = useState<ApPaymentMethod>("cash");
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

  const gemIds = useMemo(
    () => [...new Set((ap?.items ?? []).map((i) => i.gemId).filter(Boolean))],
    [ap?.items],
  );

  const { data: gemPhotos = {} } = useQuery({
    queryKey: ["ap", "detail-gem-photos", apId, gemIds.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        gemIds.map(async (id) => {
          const gem = await fetchGem(id);
          return [id, gemPrimaryPhotoUrl(gem)] as const;
        }),
      );
      const map: Record<string, string | null> = {};
      for (const [id, url] of entries) map[id] = url;
      return map;
    },
    enabled: gemIds.length > 0,
  });

  useEffect(() => {
    if (
      ap?.status === "payment_sent" &&
      (ap.paymentMethod === "cash" ||
        ap.paymentMethod === "transfer" ||
        ap.paymentMethod === "cheque")
    ) {
      setReceiveMethod(ap.paymentMethod);
    }
  }, [ap?.id, ap?.status, ap?.paymentMethod]);

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
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "AP not found."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const overdue = isApOverdue(ap);
  const done = ap.status === "done";
  const partyName = isSender
    ? ap.receiverName || "Holder"
    : ap.senderName || "Sender";
  const partyLabel = isSender ? `To ${partyName}` : `From ${partyName}`;
  const agreed = apAgreedTotal(ap);
  const gemCount = ap.items?.length || 1;

  const heroBg = overdue
    ? colors.errorContainer
    : done
      ? colors.successEmerald
      : colors.primary;
  const heroFg = overdue ? colors.error : colors.onPrimary;
  const heroMuted = overdue
    ? colors.onErrorContainer
    : colors.onPrimary + "CC";

  function lineCommission(line: ApGemLine, sale: number) {
    return sale - line.agreedPrice;
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="ap" />
      <StackHeader title="AP Detail" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <View style={[styles.hero, { backgroundColor: heroBg }]}>
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.heroIcon,
                  {
                    backgroundColor: overdue
                      ? colors.error + "22"
                      : colors.onPrimary + "22",
                  },
                ]}
              >
                <Icon
                  name={
                    overdue
                      ? "warning"
                      : isSender
                        ? "call-made"
                        : "call-received"
                  }
                  size={28}
                  color={heroFg}
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
                    {
                      color: overdue
                        ? colors.error
                        : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {overdue ? "Overdue" : apStatusLabel(ap.status)}
                </Text>
              </View>
            </View>

            <Text style={[styles.heroAmount, { color: heroFg }]} selectable>
              {formatCurrency(agreed, currency)}
            </Text>
            <Text style={[styles.heroParty, { color: heroMuted }]}>
              {partyLabel}
            </Text>
            <Text style={[styles.heroMeta, { color: heroMuted }]}>
              {gemCount} gem{gemCount === 1 ? "" : "s"}
              {ap.expectedReturnDate
                ? ` · Return ${formatRelativeDue(ap.expectedReturnDate)}`
                : ""}
            </Text>
          </View>
        </ScreenInset>

        <FormSection title="Details">
          <DetailRow
            label="Direction"
            value={isSender ? "Given" : "Taken"}
            colors={colors}
          />
          <DetailRow
            label="Counterparty"
            value={partyName}
            colors={colors}
          />
          <DetailRow
            label="Status"
            value={
              overdue
                ? `${apStatusLabel(ap.status)} · Overdue`
                : apStatusLabel(ap.status)
            }
            colors={colors}
            danger={overdue}
          />
          {ap.dateGiven ? (
            <DetailRow
              label="Given"
              value={formatRelativeTime(ap.dateGiven)}
              colors={colors}
            />
          ) : (
            <DetailRow
              label="Requested"
              value={formatRelativeTime(ap.createdAt)}
              colors={colors}
            />
          )}
          {ap.expectedReturnDate ? (
            <DetailRow
              label="Expected return"
              value={formatRelativeDue(ap.expectedReturnDate)}
              colors={colors}
              danger={overdue}
            />
          ) : null}
          {ap.rejectionReason ? (
            <DetailRow
              label="Reason"
              value={ap.rejectionReason}
              colors={colors}
              danger
            />
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
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.lineTop}>
                  <GemThumb
                    uri={gemPhotos[line.gemId] ?? null}
                    label={line.gemLabel}
                    size={40}
                    radius={10}
                  />
                  <View style={styles.lineBody}>
                    <Text
                      style={[styles.lineTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {line.gemLabel}
                    </Text>
                    <Text
                      style={[styles.meta, { color: colors.textMuted }]}
                      selectable
                    >
                      AP {formatCurrency(line.agreedPrice, line.currency)}
                      {line.soldPrice != null
                        ? ` · Sold ${formatCurrency(line.soldPrice, line.currency)}`
                        : ""}
                      {line.commission != null
                        ? ` · Comm ${formatCurrency(line.commission, line.currency)}`
                        : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.lineBadge,
                      { backgroundColor: colors.surfaceContainerHighest },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lineBadgeText,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {line.lineStatus}
                    </Text>
                  </View>
                </View>

                {isReceiver &&
                isApOngoing(ap.status) &&
                line.lineStatus === "held" ? (
                  <View style={styles.row}>
                    <Button
                      title="Sell"
                      icon="sell"
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
                      icon="undo"
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
                      <Text
                        style={{ color: colors.textMuted }}
                        selectable
                      >
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

        {isSender && ap.status === "pending" ? (
          <ScreenInset>
            <Button
              title="Cancel request"
              variant="secondary"
              icon="cancel"
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

        {isReceiver && ap.status === "pending" ? (
          <>
            <FormSectionLabel title="Respond" />
            <ScreenInset style={styles.row}>
              <Button
                title="Accept"
                icon="check"
                loading={loading}
                onPress={() =>
                  run(
                    () => respondApRequest(ap.id, "accepted"),
                    "AP accepted",
                  )
                }
                style={styles.flex}
              />
              <Button
                title="Reject"
                variant="secondary"
                icon="close"
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
          </>
        ) : null}

        {isReceiver &&
        isApOngoing(ap.status) &&
        (ap.items ?? []).some((i) => i.lineStatus === "sold") ? (
          <FormSection title="Payment to owner">
            <Text style={[styles.meta, { color: colors.textMuted }]} selectable>
              Owed {formatCurrency(owed, currency)}
            </Text>
            <ChipSelect
              label="Method"
              options={PAY_METHODS}
              value={payMethod}
              onChange={setPayMethod}
              layout="split"
            />
            <Input
              label="Amount"
              value={payAmount || String(owed || "")}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              leftIcon="payments"
            />
            <Button
              title={
                payMethod === "cheque"
                  ? "Continue with cheque"
                  : "Payment Sent"
              }
              icon={payMethod === "cheque" ? "money-check-dollar" : "send"}
              loading={loading}
              onPress={() => {
                const amount = parseFloat(payAmount || String(owed));
                if (!amount || Number.isNaN(amount)) {
                  toast.error("Enter payment amount");
                  return;
                }
                if (payMethod === "cheque") {
                  router.push({
                    pathname: "/(marketplace)/(tabs)/workspace/cheques/add",
                    params: {
                      amount: String(amount),
                      apRecordId: ap.id,
                      gemId: ap.items?.[0]?.gemId,
                      direction: "given",
                      confirmApSent: "1",
                    },
                  });
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

        {isSender && ap.status === "payment_sent" ? (
          <FormSection title="Confirm payment">
            <Text
              style={[styles.meta, { color: colors.onSurface }]}
              selectable
            >
              {ap.paymentMethod
                ? `Marked sent as ${ap.paymentMethod}`
                : "Payment"}{" "}
              · {formatCurrency(ap.paymentAmount ?? owed, currency)}
            </Text>
            <ChipSelect
              label="How was it received?"
              options={PAY_METHODS}
              value={receiveMethod}
              onChange={setReceiveMethod}
              layout="split"
            />
            <Button
              title={
                receiveMethod === "cheque"
                  ? "Continue with cheque"
                  : "Payment Received"
              }
              icon={
                receiveMethod === "cheque"
                  ? "money-check-dollar"
                  : "check-circle"
              }
              loading={loading}
              onPress={() => {
                if (receiveMethod === "cheque") {
                  router.push({
                    pathname: "/(marketplace)/(tabs)/workspace/cheques/add",
                    params: {
                      amount: String(ap.paymentAmount ?? owed),
                      contactId: ap.receiverContactId,
                      apRecordId: ap.id,
                      gemId: ap.items?.[0]?.gemId,
                      direction: "received",
                      confirmApReceived: "1",
                    },
                  });
                  return;
                }
                run(
                  () =>
                    apPaymentReceived(ap.id, { method: receiveMethod }),
                  "Payment confirmed — done",
                );
              }}
            />
          </FormSection>
        ) : null}

        {done ? (
          <FormSection title="Settled">
            <View style={styles.waitRow}>
              <Icon
                name="check-circle"
                size={18}
                color={colors.successEmerald}
              />
              <Text style={{ color: colors.textMuted, flex: 1 }}>
                Payment received. Money ledgers updated on both sides.
              </Text>
            </View>
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

function DetailRow({
  label,
  value,
  colors,
  danger,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  danger?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.detailValue,
          { color: danger ? colors.error : colors.onSurface },
        ]}
        selectable
      >
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
  heroParty: { ...Typography.labelMd, fontWeight: "600" },
  heroMeta: { ...Typography.bodySmall },
  detailRow: { gap: 2 },
  detailLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  detailValue: { ...Typography.bodyMd },
  lineCard: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: 10,
    marginBottom: Spacing.sm,
  },
  lineTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  lineBody: { flex: 1, gap: 2, minWidth: 0 },
  lineTitle: { ...Typography.bodyMd, fontWeight: "600" },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  lineBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  meta: { ...Typography.bodySmall },
  row: { flexDirection: "row", gap: Spacing.sm },
  flex: { flex: 1 },
  sellBox: { gap: Spacing.sm },
  waitRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
});
