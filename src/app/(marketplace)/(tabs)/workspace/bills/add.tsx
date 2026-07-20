import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipSelect } from "@/components/ui/chip-select";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactPicker } from "@/components/workspace/contact-picker";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  createBill,
  fetchContacts,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import { addBillSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { BillDirection } from "@/types";

const DIRECTIONS = [
  {
    value: "payable" as const,
    label: "To pay",
    subtitle: "You owe them",
    icon: "call-made" as const,
  },
  {
    value: "receivable" as const,
    label: "To receive",
    subtitle: "They owe you",
    icon: "call-received" as const,
  },
];

export default function AddBillScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<BillDirection>("payable");
  const [amount, setAmount] = useState("");
  const [contactId, setContactId] = useState("");
  const [dueDays, setDueDays] = useState("7");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const duePreview = useMemo(() => {
    const days = parseInt(dueDays, 10);
    if (Number.isNaN(days) || days < 0) return null;
    return format(addDays(new Date(), days), "d MMM yyyy");
  }, [dueDays]);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addBillSchema, {
      direction,
      amount,
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
        counterpartyContactId: result.data.contactId,
        dueDate,
        commissionPercent: result.data.commissionPercent,
        notes: result.data.notes,
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

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add Bill" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Remind yourself about money to pay or collect, with optional
            commission.
          </Text>
        </ScreenInset>

        <FormSection title="Direction">
          <ChipSelect
            options={DIRECTIONS}
            value={direction}
            onChange={(v) => setDirection(v as BillDirection)}
          />
        </FormSection>

        <FormSection title="Details">
          <Input
            label="Amount"
            value={amount}
            onChangeText={(t) => {
              setAmount(t);
              clearField("amount");
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="payments"
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
            helperText="Applied when you record a payment"
          />
          <ContactPicker
            label="For whom"
            value={contactId}
            onChange={(id) => {
              setContactId(id);
              clearField("contactId");
            }}
            contacts={contacts}
            allowedBusinessKinds={["traders", "lapidaries"]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.xxl, gap: Spacing.md },
  lead: {
    ...Typography.bodyMd,
    marginBottom: Spacing.sm,
  },
});
