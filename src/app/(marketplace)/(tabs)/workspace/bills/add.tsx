import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipSelect } from "@/components/ui/chip-select";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactPicker } from "@/components/workspace/contact-picker";
import {
  GemPickerSheet,
  GemSelectField,
} from "@/components/workspace/gem-picker-sheet";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
  billCommissionAmount,
  billNetAfterCommission,
} from "@/features/workspace/bill-utils";
import {
  createBill,
  fetchContacts,
  fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import { formatCurrency } from "@/lib/utils";
import { addBillSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { BillDirection, WorkspaceGem } from "@/types";

const DIRECTIONS = [
  {
    value: "payable" as const,
    label: "To pay",
    subtitle: "You owe them · your commission cut",
    icon: "call-made" as const,
  },
  {
    value: "receivable" as const,
    label: "To receive",
    subtitle: "They owe you · their commission cut",
    icon: "call-received" as const,
  },
];

export default function AddBillScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<BillDirection>("payable");
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: "",
    currency: preferred,
  });
  const [contactId, setContactId] = useState("");
  const [dueDays, setDueDays] = useState("7");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [gemIds, setGemIds] = useState<string[]>([]);
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const availableGems = useMemo(
    () => gems.filter((g) => !gemIds.includes(g.id)),
    [gems, gemIds],
  );

  const selectedGems = useMemo(
    () =>
      gemIds
        .map((id) => gems.find((g) => g.id === id))
        .filter((g): g is WorkspaceGem => !!g),
    [gemIds, gems],
  );

  const duePreview = useMemo(() => {
    const days = parseInt(dueDays, 10);
    if (Number.isNaN(days) || days < 0) return null;
    return format(addDays(new Date(), days), "d MMM yyyy");
  }, [dueDays]);

  const faceAmount = useMemo(() => {
    const n = Number(String(money.amount).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [money.amount]);

  const commissionPct = useMemo(() => {
    const raw = commissionPercent.trim();
    if (!raw) return null;
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }, [commissionPercent]);

  const commissionValue = billCommissionAmount(faceAmount, commissionPct);
  const netValue = billNetAfterCommission(faceAmount, commissionPct);
  const showBreakdown = faceAmount > 0 && commissionValue > 0;

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addGem(gem: WorkspaceGem) {
    setGemIds((prev) => (prev.includes(gem.id) ? prev : [...prev, gem.id]));
    setGemSheetOpen(false);
  }

  function removeGem(id: string) {
    setGemIds((prev) => prev.filter((g) => g !== id));
  }

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addBillSchema, {
      direction,
      amount: money.amount,
      dueDays,
      contactId,
      commissionPercent,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const dueDate = Timestamp.fromDate(
        addDays(new Date(), result.data.dueDays),
      );
      const id = await createBill(user.uid, {
        direction: result.data.direction,
        amount: result.data.amount,
        currency: money.currency,
        counterpartyContactId: result.data.contactId,
        dueDate,
        commissionPercent: result.data.commissionPercent,
        notes: result.data.notes,
        gemIds,
      });
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Bill saved");
      router.replace(`/(marketplace)/(tabs)/workspace/bills/${id}` as never);
    } catch (e) {
      toast.error(friendlyError(e, "Could not save bill."));
    } finally {
      setLoading(false);
    }
  }

  const contactName =
    contacts.find((c) => c.id === contactId)?.displayName ?? "them";

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add Bill" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Track money to pay or collect. Commission is applied when you
            record a payment.
          </Text>
        </ScreenInset>

        <FormSection title="Direction">
          <ChipSelect
            options={DIRECTIONS}
            value={direction}
            onChange={(v) => setDirection(v as BillDirection)}
          />
        </FormSection>

        <FormSection title="Gems">
          {selectedGems.map((gem) => (
            <View
              key={gem.id}
              style={[
                styles.gemCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.gemHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[styles.gemTitle, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {gem.variety?.trim() ||
                      formatGemType(gem.gemType) ||
                      gem.sku}
                  </Text>
                  <Text
                    style={[styles.gemSub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {gem.sku} · {gem.currentWeight} ct
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeGem(gem.id)}
                  accessibilityLabel="Remove gem"
                  hitSlop={8}
                >
                  <Icon name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}
          <GemSelectField
            label={gemIds.length ? "Add another gem" : "Link gems (optional)"}
            gem={null}
            placeholder="Select a gem"
            onPress={() => setGemSheetOpen(true)}
          />
        </FormSection>

        <FormSection title="Details">
          <CurrencyAmountField
            label="Amount"
            value={money}
            onChange={(next) => {
              setMoney(next);
              clearField("amount");
            }}
            error={errors.amount}
          />
          <Input
            label="Due in (days)"
            value={dueDays}
            onChangeText={(t) => {
              setDueDays(t);
              clearField("dueDays");
            }}
            keyboardType="number-pad"
            placeholder="7"
            leftIcon="event"
            error={errors.dueDays}
            helperText={duePreview ? `Due ${duePreview}` : undefined}
          />
          <Input
            label="Commission %"
            value={commissionPercent}
            onChangeText={(t) => {
              setCommissionPercent(t);
              clearField("commissionPercent");
            }}
            keyboardType="decimal-pad"
            placeholder="Optional"
            leftIcon="percent"
            error={errors.commissionPercent}
            helperText={
              direction === "payable"
                ? "From the amount — counted as your income when you record payment"
                : "From the amount — counted as their cut on your books when you record payment"
            }
          />

          {showBreakdown ? (
            <View
              style={[
                styles.breakdown,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <BreakdownRow
                label="Amount"
                value={formatCurrency(faceAmount, money.currency)}
                colors={colors}
              />
              {direction === "payable" ? (
                <>
                  <BreakdownRow
                    label="Your commission"
                    value={formatCurrency(commissionValue, money.currency)}
                    colors={colors}
                    accent={colors.successEmerald}
                  />
                  <BreakdownRow
                    label="Total to pay"
                    value={formatCurrency(netValue, money.currency)}
                    colors={colors}
                    strong
                  />
                </>
              ) : (
                <>
                  <BreakdownRow
                    label={`Commission to ${contactName}`}
                    value={`− ${formatCurrency(commissionValue, money.currency)}`}
                    colors={colors}
                    accent={colors.error}
                  />
                  <BreakdownRow
                    label="You receive"
                    value={formatCurrency(netValue, money.currency)}
                    colors={colors}
                    strong
                  />
                </>
              )}
            </View>
          ) : null}

          <ContactPicker
            label={direction === "payable" ? "To" : "From"}
            value={contactId}
            onChange={(id) => {
              setContactId(id);
              clearField("contactId");
            }}
            contacts={contacts}
            allowedBusinessKinds={["traders", "lapidaries"]}
            emptyHint="Pick a contact or GemFort business."
            error={errors.contactId}
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            leftIcon="notes"
            multiline
          />
        </FormSection>
      </ThemedScrollView>

      <FormFooter
        title="Save bill"
        loading={loading}
        onPress={handleSubmit}
        icon="check"
      />

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={availableGems}
        value=""
        title="Select gem for bill"
        emptyHint="No more gems available. Add gems in inventory first."
        onSelect={addGem}
      />
    </SafeAreaView>
  );
}

function BreakdownRow({
  label,
  value,
  colors,
  accent,
  strong,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  accent?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text
        style={[
          styles.breakdownLabel,
          {
            color: colors.onSurfaceVariant,
            fontWeight: strong ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.breakdownValue,
          {
            color: accent ?? (strong ? colors.onSurface : colors.onSurface),
            fontWeight: strong ? "700" : "600",
          },
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
  content: { paddingBottom: Spacing.xxl, gap: Spacing.md },
  lead: {
    ...Typography.bodyMd,
    marginBottom: Spacing.sm,
  },
  gemCard: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  gemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  gemTitle: { ...Typography.bodyMd, fontWeight: "600" },
  gemSub: { ...Typography.caption },
  breakdown: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  breakdownLabel: { ...Typography.bodySmall, flex: 1 },
  breakdownValue: {
    ...Typography.bodyMd,
    fontVariant: ["tabular-nums"],
  },
});
