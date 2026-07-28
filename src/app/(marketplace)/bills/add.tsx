import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipSelect } from "@/components/ui/chip-select";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactPicker } from "@/components/workspace/contact-picker";
import {
  GemPickerSheet,
  GemSelectField,
} from "@/components/workspace/gem-picker-sheet";
import {
  JobPickerSheet,
  JobSelectField,
} from "@/components/workspace/job-picker-sheet";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { resolveProfileRole } from "@/constants/roles";
import { fetchLapidaryJobs } from "@/features/marketplace/request-service";
import {
  subscribeContacts,
  subscribeGems,
  subscribeLapidaryJobs,
} from "@/features/workspace/firestore-subscriptions";
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
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import { decodeShareParam } from "@/lib/incoming-share";
import { formatCurrency } from "@/lib/utils";
import { addBillSchema, parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { BillDirection, LapidaryJob, WorkspaceGem } from "@/types";

const DIRECTIONS = [
  {
    value: "payable" as const,
    label: "To pay",
    icon: "call-made" as const,
  },
  {
    value: "receivable" as const,
    label: "To receive",
    icon: "call-received" as const,
  },
];

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default function AddBillScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isLapidary = resolveProfileRole(profile) === "lapidary";
  const raw = useLocalSearchParams<{
    amount?: string;
    notes?: string;
    jobId?: string;
  }>();
  const paramAmount = firstParam(raw.amount);
  const paramNotes = decodeShareParam(raw.notes);
  const paramJobId = firstParam(raw.jobId);

  const [direction, setDirection] = useState<BillDirection>("payable");

  useEffect(() => {
    if (isLapidary) setDirection("receivable");
  }, [isLapidary]);
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: paramAmount,
    currency: preferred,
  });
  const [contactId, setContactId] = useState("");
  const [dueDays, setDueDays] = useState("7");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState(paramNotes);
  const [gemIds, setGemIds] = useState<string[]>([]);
  const [jobId, setJobId] = useState(paramJobId);
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user && !isLapidary,
  });

  const { data: jobs = [] } = useFirestoreLiveQuery({
    queryKey: ["lapidary-jobs", user?.uid],
    queryFn: () => fetchLapidaryJobs(user!.uid),
    subscribe: (onData, onError) =>
      subscribeLapidaryJobs(user!.uid, onData, onError),
    enabled: !!user && isLapidary,
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

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId],
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
    if (isLapidary) return null;
    const rawPct = commissionPercent.trim();
    if (!rawPct) return null;
    const n = Number(rawPct.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }, [commissionPercent, isLapidary]);

  const commissionValue = billCommissionAmount(faceAmount, commissionPct);
  const netValue = billNetAfterCommission(faceAmount, commissionPct);
  const showBreakdown = !isLapidary && faceAmount > 0 && commissionValue > 0;

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

  function selectJob(job: LapidaryJob) {
    setJobId(job.id);
    clearField("jobId");
    setJobSheetOpen(false);
  }

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addBillSchema, {
      direction,
      amount: money.amount,
      dueDays,
      contactId,
      commissionPercent: isLapidary ? "" : commissionPercent,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      await withLoading(async () => {
        const dueDate = Timestamp.fromDate(
          addDays(new Date(), result.data.dueDays),
        );
        const id = await createBill(user.uid, {
          direction: result.data.direction,
          amount: result.data.amount,
          currency: money.currency,
          counterpartyContactId: result.data.contactId,
          dueDate,
          commissionPercent: isLapidary ? null : result.data.commissionPercent,
          notes: result.data.notes,
          gemIds: isLapidary ? [] : gemIds,
          jobId: isLapidary ? jobId || null : null,
          status: isLapidary ? "ongoing" : "open",
        });
        await queryClient.invalidateQueries({ queryKey: ["bills"] });
        toast.success(
          isLapidary ? "Bill started — ongoing until due date" : "Bill saved",
        );
        replaceWithAnchor(
          `/(marketplace)/(tabs)/workspace/bills/${id}` as never,
        );
      }, "Adding bill…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not save bill."));
    }
  }

  const contactName =
    contacts.find((c) => c.id === contactId)?.displayName ?? "them";

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add Bill" closeIcon />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSection title="Direction">
          <ChipSelect
            options={DIRECTIONS}
            value={direction}
            onChange={(v) => setDirection(v as BillDirection)}
          />
        </FormSection>

        {isLapidary ? (
          <FormSection title="Job">
            <JobSelectField
              label="Link job"
              job={selectedJob}
              placeholder="Select a workshop job"
              onPress={() => setJobSheetOpen(true)}
              onClear={jobId ? () => setJobId("") : undefined}
              error={errors.jobId}
            />
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Tracks payment for a received gem service request until the due
              date.
            </Text>
          </FormSection>
        ) : (
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
        )}

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
            helperText={
              duePreview
                ? isLapidary
                  ? `Ongoing until ${duePreview}`
                  : `Due ${duePreview}`
                : undefined
            }
          />
          {!isLapidary ? (
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
            />
          ) : null}

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
        onPress={handleSubmit}
        icon="check"
      />

      {!isLapidary ? (
        <GemPickerSheet
          visible={gemSheetOpen}
          onClose={() => setGemSheetOpen(false)}
          gems={availableGems}
          value=""
          title="Select gem for bill"
          emptyHint="No more gems available. Add gems in inventory first."
          onSelect={addGem}
        />
      ) : (
        <JobPickerSheet
          visible={jobSheetOpen}
          onClose={() => setJobSheetOpen(false)}
          jobs={jobs}
          value={jobId}
          title="Select job for bill"
          emptyHint="Accept a service request in Jobs first."
          onSelect={selectJob}
        />
      )}
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
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.xxl, gap: Spacing.md },
  helper: { ...Typography.caption, marginTop: Spacing.xs },
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
