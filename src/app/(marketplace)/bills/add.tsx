import { useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    ChoicePreviewCard,
    ChoiceTileGrid,
} from "@/components/ui/choice-tile-grid";
import {
    CurrencyAmountField,
    type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import {
    Accent,
    DetailRows,
    TotalRow,
    type DetailRowProps,
} from "@/components/ui/detail-kit";
import { ScanFillStatus } from "@/components/scan/scan-fill-status";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { ReceiptField } from "@/components/ui/receipt-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { SheetFooter } from "@/components/ui/sheet-footer";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactPicker } from "@/components/workspace/contact-picker";
import { CalendarSyncToggle } from "@/components/workspace/calendar-sync-toggle";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import {
    GemPickerSheet,
    GemSelectField,
} from "@/components/workspace/gem-picker-sheet";
import {
    JobPickerSheet,
    JobSelectField,
} from "@/components/workspace/job-picker-sheet";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { resolveCurrencyCode } from "@/constants/currencies";
import { resolveProfileRole } from "@/constants/roles";
import { fetchLapidaryJobs } from "@/features/marketplace/request-service";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import {
    billCommissionAmount,
    billNetAfterCommission,
} from "@/features/workspace/bill-utils";
import {
    subscribeContacts,
    subscribeGems,
    subscribeLapidaryJobs,
} from "@/features/workspace/firestore-subscriptions";
import {
    createBill,
    fetchContacts,
    fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutofillGuard, useDocumentReader } from "@/hooks/use-document-reader";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import { commitmentDeepLink } from "@/features/calendar-sync/links";
import { makeSyncCommitment } from "@/features/calendar-sync/commitments";
import { writeCommitmentToDevice } from "@/features/calendar-sync/sync-item";
import { uploadReceipt } from "@/lib/firebase/receipt-service";
import type { LocalMedia } from "@/lib/firebase/storage-service";
import {
    matchContact,
    readReceipt,
    type ReceiptExtraction,
} from "@/lib/document-extract";
import { mimeFromUri } from "@/lib/scan";
import { decodeShareParam } from "@/lib/incoming-share";
import { formatCurrency } from "@/lib/utils";
import { addBillSchema, parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { BillDirection, LapidaryJob, WorkspaceGem } from "@/types";

const DIRECTIONS = [
  {
    value: "payable" as const,
    label: "To pay",
    icon: "call-made" as const,
    accent: Accent.amber,
  },
  {
    value: "receivable" as const,
    label: "To receive",
    icon: "call-received" as const,
    accent: Accent.emerald,
  },
];

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function dueDaysFromParam(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "7";
  return String(Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000)));
}

export default function AddBillScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isLapidary = resolveProfileRole(profile) === "lapidary";
  const raw = useLocalSearchParams<{
    amount?: string;
    notes?: string;
    jobId?: string;
    gemId?: string;
    direction?: string;
    dueDate?: string;
    currency?: string;
    counterpartyBusinessId?: string;
    /** Scanned bill (Scan & add) to attach as the receipt. */
    sharedReceiptUri?: string;
  }>();
  const paramAmount = firstParam(raw.amount);
  const paramReceiptUri = firstParam(raw.sharedReceiptUri);
  const paramNotes = decodeShareParam(raw.notes);
  const paramJobId = firstParam(raw.jobId);
  const paramGemId = firstParam(raw.gemId);
  const paramDirection = firstParam(raw.direction);
  const paramDueDate = firstParam(raw.dueDate);
  const paramCurrency = resolveCurrencyCode(firstParam(raw.currency), preferred);
  const paramCounterpartyBusinessId = firstParam(raw.counterpartyBusinessId);

  const presetDirection: BillDirection | null = isLapidary
    ? "receivable"
    : paramDirection === "payable" || paramDirection === "receivable"
      ? paramDirection
      : null;

  const [step, setStep] = useState(presetDirection ? 1 : 0);
  const [direction, setDirection] = useState<BillDirection | null>(
    presetDirection,
  );
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: paramAmount,
    currency: paramCurrency,
  });
  const [contactId, setContactId] = useState("");
  const [dueDays, setDueDays] = useState(() => dueDaysFromParam(paramDueDate));
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState(paramNotes);
  const [receipt, setReceipt] = useState<LocalMedia | null>(() =>
    paramReceiptUri
      ? {
          uri: paramReceiptUri,
          kind: "image",
          mimeType: mimeFromUri(paramReceiptUri),
          fileName: "scanned-bill.webp",
        }
      : null,
  );
  const [gemIds, setGemIds] = useState<string[]>(
    paramGemId ? [paramGemId] : [],
  );
  const [jobId, setJobId] = useState(paramJobId);
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [reminderSyncEnabled, setReminderSyncEnabled] = useState(true);

  if (isLapidary && direction !== "receivable") {
    setDirection("receivable");
    setStep(1);
  }

  const directionMeta = DIRECTIONS.find((d) => d.value === direction);
  const canChangeDirection = !presetDirection && !isLapidary;

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const linkedContactId = paramCounterpartyBusinessId
    ? contacts.find(
        (contact) => contact.linkedBusinessId === paramCounterpartyBusinessId,
      )?.id ?? ""
    : "";
  const selectedContactId = contactId || linkedContactId;

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
    () => {
      const gemIdSet = new Set(gemIds);
      return gems.filter((g) => !gemIdSet.has(g.id));
    },
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

  // Read the attached bill on device and fill amount, due date, who it is
  // from and a reference note. Never overwrites what the user typed.
  const [scan, setScan] = useState<ReceiptExtraction | null>(null);
  const [scanFilled, setScanFilled] = useState<string[] | null>(null);
  const autofill = useAutofillGuard<"amount" | "dueDays" | "notes" | "contactId">({
    dueDays: dueDaysFromParam(paramDueDate),
  });
  const { reading } = useDocumentReader(
    receipt?.kind === "image" ? receipt.uri : null,
    readReceipt,
    (result) => {
      setScan(result);
      if (!result) {
        setScanFilled([]);
        return;
      }
      const filled: string[] = [];
      if (result.amount && autofill.canFill("amount", money.amount)) {
        const amount = String(result.amount);
        setMoney((prev) => ({ amount, currency: result.currency ?? prev.currency }));
        autofill.mark("amount", amount);
        clearField("amount");
        filled.push("amount");
      }
      if (result.dueDate && autofill.canFill("dueDays", dueDays)) {
        const days = String(
          Math.min(730, Math.max(0, differenceInCalendarDays(result.dueDate, new Date()))),
        );
        setDueDays(days);
        autofill.mark("dueDays", days);
        clearField("dueDays");
        filled.push("due date");
      }
      const note = [
        result.reference ? `Ref ${result.reference}` : null,
        result.merchant ?? null,
        result.date ? format(result.date, "d MMM yyyy") : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (note && autofill.canFill("notes", notes)) {
        setNotes(note);
        autofill.mark("notes", note);
        filled.push("notes");
      }
      setScanFilled(filled);
    },
  );

  // A payable bill comes from the business printed at the top. Direction and
  // contacts may arrive after the scan is read.
  const partyKey = scan && direction === "payable" ? `${contacts.length}` : null;
  const [appliedPartyKey, setAppliedPartyKey] = useState<string | null>(null);
  if (scan && partyKey !== null && partyKey !== appliedPartyKey) {
    setAppliedPartyKey(partyKey);
    const match = matchContact(scan.merchant, contacts);
    if (match && autofill.canFill("contactId", contactId)) {
      setContactId(match.id);
      autofill.mark("contactId", match.id);
      clearField("contactId");
      setScanFilled((prev) => (prev?.includes("contact") ? prev : [...(prev ?? []), "contact"]));
    }
  }

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
  const hasCommission = !isLapidary && faceAmount > 0 && commissionValue > 0;

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSelectDirection(next: BillDirection) {
    setDirection(next);
    clearField("direction");
    setStep(1);
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

  const [submitting, handleSubmit] = usePendingAction(async () => {
    if (!user || !direction) return;
    const result = parseForm(addBillSchema, {
      direction,
      amount: money.amount,
      dueDays,
      contactId: selectedContactId,
      commissionPercent: isLapidary ? "" : commissionPercent,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      const dueDateValue = addDays(new Date(), result.data.dueDays);
      const dueDate = Timestamp.fromDate(dueDateValue);
      const receiptUrl = await uploadReceipt(user.uid, receipt);
      const id = await createBill(user.uid, {
        direction: result.data.direction,
        amount: result.data.amount,
        currency: money.currency,
        counterpartyContactId: result.data.contactId,
        receiptUrl,
        dueDate,
        commissionPercent: isLapidary ? null : result.data.commissionPercent,
        notes: result.data.notes,
        gemIds: isLapidary ? [] : gemIds,
        jobId: jobId || null,
        status: jobId ? "ongoing" : "open",
      });
      if (calendarSyncEnabled) {
        const commitment = makeSyncCommitment({
          surface: "calendar",
          sourceType: "bill",
          sourceId: id,
          title: `Bill due: ${result.data.direction}`,
          date: dueDateValue,
          url: commitmentDeepLink("bill", id),
        });
        if ((await writeCommitmentToDevice(commitment)) === false) {
          toast.info("Bill saved, but its calendar entry could not be added.");
        }
      }
      if (reminderSyncEnabled) {
        const commitment = makeSyncCommitment({
          surface: "reminder",
          sourceType: "bill",
          sourceId: id,
          title: `Bill due: ${result.data.direction}`,
          date: dueDateValue,
          url: commitmentDeepLink("bill", id),
        });
        if ((await writeCommitmentToDevice(commitment)) === false) {
          toast.info("Bill saved, but its reminder could not be added.");
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success(
        isLapidary
          ? "Bill started — ongoing until due date"
          : "Bill saved",
      );
      replaceWithAnchor(
        `/(marketplace)/(tabs)/workspace/bills/${id}` as never,
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not save bill."));
    }
  });

  const contactName =
    contacts.find((c) => c.id === selectedContactId)?.displayName ?? "them";

  // Running total: face amount, commission split, and when it falls due.
  const summaryRows: ({ key: string } & DetailRowProps)[] = [
    {
      key: "amount",
      icon: "receipt-long",
      accent: colors.onSurfaceVariant,
      label: "Amount",
      value: formatCurrency(faceAmount, money.currency),
    },
    ...(hasCommission
      ? [
          direction === "payable"
            ? {
                key: "commission",
                icon: "percent" as const,
                accent: Accent.emerald,
                label: "Your commission",
                value: (
                  <Text style={[styles.summaryValue, { color: Accent.emerald }]}>
                    {formatCurrency(commissionValue, money.currency)}
                  </Text>
                ),
              }
            : {
                key: "commission",
                icon: "percent" as const,
                accent: Accent.rose,
                label: `Commission to ${contactName}`,
                value: (
                  <Text style={[styles.summaryValue, { color: Accent.rose }]}>
                    {`− ${formatCurrency(commissionValue, money.currency)}`}
                  </Text>
                ),
              },
        ]
      : []),
    ...(duePreview
      ? [
          {
            key: "due",
            icon: "event" as const,
            accent: Accent.amber,
            label: isLapidary ? "Ongoing until" : "Due",
            value: duePreview,
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title={step === 0 ? "Direction" : "Add Bill"}
        closeIcon
        image={require("@/assets/images/bill-icon.png")}
      />

      {step === 0 ? (
        <View
          style={[
            styles.dirStep,
            { paddingBottom: Math.max(insets.bottom, Spacing.xl) },
          ]}
        >
          <ChoiceTileGrid
            layout="pair"
            options={DIRECTIONS}
            value={direction}
            onChange={handleSelectDirection}
            error={errors.direction}
          />
        </View>
      ) : (
        <>
          <ThemedScrollView
            style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {directionMeta ? (
              <ChoicePreviewCard
                label={directionMeta.label}
                icon={directionMeta.icon}
                accent={directionMeta.accent}
                onPress={canChangeDirection ? () => setStep(0) : undefined}
              />
            ) : null}

            <ScanFillStatus reading={reading} filled={scanFilled} document="bill" />

            {isLapidary ? (
              <FormSection
                title="Job"
                hint="Tracks payment for a received gem service request until the due date."
              >
                <JobSelectField
                  label="Link job"
                  job={selectedJob}
                  placeholder="Select a workshop job"
                  onPress={() => setJobSheetOpen(true)}
                  onClear={jobId ? () => setJobId("") : undefined}
                  error={errors.jobId}
                />
              </FormSection>
            ) : (
              <FormSection title="Gems">
                {selectedGems.length ? (
                  <DetailRows
                    rows={selectedGems.map((gem) => {
                      const label =
                        gem.title?.trim() || gem.variety?.trim() || "Gem";
                      return {
                        key: gem.id,
                        leading: <GemLeading gem={gem} label={label} />,
                        label,
                        hint: `${formatGemType(gem.gemType)} · ${gem.currentWeight} ct`,
                        value: (
                          <Pressable
                            onPress={() => removeGem(gem.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Remove gem"
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.removeBtn,
                              { backgroundColor: colors.surfaceContainerHigh },
                              pressed && styles.pressed,
                            ]}
                          >
                            <Icon name="close" size={18} color={colors.onSurfaceVariant} />
                          </Pressable>
                        ),
                      };
                    })}
                  />
                ) : null}
                <GemSelectField
                  label={
                    gemIds.length ? "Add another gem" : "Link gems (optional)"
                  }
                  gem={null}
                  placeholder="Select a gem"
                  onPress={() => setGemSheetOpen(true)}
                />
              </FormSection>
            )}

            <FormSection title={direction === "payable" ? "Pay to" : "Collect from"}>
              <ContactPicker
                label={direction === "payable" ? "To" : "From"}
                value={selectedContactId}
                onChange={(id) => {
                  setContactId(id);
                  clearField("contactId");
                }}
                contacts={contacts}
                allowedBusinessKinds={["traders", "lapidaries"]}
                emptyHint="Pick a contact or GemFort business."
                error={errors.contactId}
              />
            </FormSection>

            <FormSection title="Amount">
              <CurrencyAmountField
                label="Amount"
                value={money}
                onChange={(next) => {
                  setMoney(next);
                  clearField("amount");
                }}
                error={errors.amount}
              />
              {!isLapidary ? (
                <MaskedInput
                  label="Commission %"
                  mode="percent"
                  value={commissionPercent}
                  onChangeText={(t) => {
                    setCommissionPercent(t);
                    clearField("commissionPercent");
                  }}
                  placeholder="Optional"
                  leftIcon="percent"
                  error={errors.commissionPercent}
                />
              ) : null}
            </FormSection>

            <FormSection title="Due date">
              <MaskedInput
                label="Due in (days)"
                mode="custom"
                mask="999"
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
              <CalendarSyncToggle
                surface="calendar"
                value={calendarSyncEnabled}
                onValueChange={setCalendarSyncEnabled}
                colors={colors}
              />
              <CalendarSyncToggle
                surface="reminder"
                value={reminderSyncEnabled}
                onValueChange={setReminderSyncEnabled}
                colors={colors}
              />
            </FormSection>

            <FormSection title="Notes & receipt">
              <Input
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                leftIcon="notes"
                multiline
              />
              <ReceiptField value={receipt} onChange={setReceipt} />
            </FormSection>

            {faceAmount > 0 && direction ? (
              <FormSection title="Summary">
                <DetailRows rows={summaryRows} />
                <TotalRow
                  label={direction === "payable" ? "Total to pay" : "You receive"}
                  value={formatCurrency(netValue, money.currency)}
                  accent={direction === "payable" ? Accent.amber : Accent.emerald}
                />
              </FormSection>
            ) : null}
          </ThemedScrollView>

          <SheetFooter>
            <FormFooter
              title="Add bill"
              onPress={handleSubmit}
              loading={submitting}
              icon="check"
              secondaryTitle={canChangeDirection ? "Back" : undefined}
              onSecondaryPress={canChangeDirection ? () => setStep(0) : undefined}
            />
          </SheetFooter>
        </>
      )}

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
    </View>
  );
}

/** Gem photo, else the gem's artwork on its own colour. */
function GemLeading({ gem, label }: { gem: WorkspaceGem; label: string }) {
  const photo = gemPrimaryPhotoUrl(gem);
  if (photo) return <GemThumb uri={photo} label={label} size={44} radius={12} />;
  return <GemArtwork gem={gem} artScale={0.8} style={styles.gemArt} />;
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  dirStep: {
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.md,
  },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  gemArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  summaryValue: {
    includeFontPadding: false,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
