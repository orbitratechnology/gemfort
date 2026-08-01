import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { ChoicePreviewCard, ChoiceTileGrid } from "@/components/ui/choice-tile-grid";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { MediaField } from "@/components/ui/media-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  BankPickerSheet,
  BankSelectField,
  BranchPickerSheet,
  BranchSelectField,
} from "@/components/workspace/bank-picker-sheet";
import { ChequePreviewCard } from "@/components/workspace/cheque-preview-card";
import { ContactPicker } from "@/components/workspace/contact-picker";
import { Spacing, Typography } from "@/constants/design-tokens";
import { getBankByCode } from "@/constants/sri-lanka-banks";
import { bankHasBranches } from "@/constants/sri-lanka-branches";
import { subscribeContacts } from "@/features/workspace/firestore-subscriptions";
import {
  createCheque,
  fetchContacts,
  recordBillPayment,
  updateGemLifecycle,
} from "@/features/workspace/workspace-service";
import {
  apPaymentReceived,
  apPaymentSent,
} from "@/features/workspace/ap-lifecycle-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from "@/lib/firebase/storage-service";
import { decodeShareParam } from "@/lib/incoming-share";
import { addChequeSchema, parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { ChequeDirection } from "@/types";

const DIRECTIONS = [
  {
    value: "given" as const,
    label: "Given",
    icon: "call-made" as const,
  },
  {
    value: "received" as const,
    label: "Taken",
    icon: "call-received" as const,
  },
];

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default function AddChequeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const raw = useLocalSearchParams<{
    amount?: string;
    gemId?: string;
    apRecordId?: string;
    billId?: string;
    contactId?: string;
    direction?: string;
    markSold?: string;
    settleAmount?: string;
    confirmApSent?: string;
    confirmApReceived?: string;
    sharedImageUri?: string;
    notes?: string;
  }>();

  const paramAmount = firstParam(raw.amount);
  const paramContactId = firstParam(raw.contactId);
  const paramGemId = firstParam(raw.gemId) || null;
  const paramApRecordId = firstParam(raw.apRecordId) || null;
  const paramBillId = firstParam(raw.billId) || null;
  const paramDirection = firstParam(raw.direction);
  const markSold = firstParam(raw.markSold) === "1";
  const settleAmount = firstParam(raw.settleAmount);
  const confirmApSent = firstParam(raw.confirmApSent) === "1";
  const confirmApReceived = firstParam(raw.confirmApReceived) === "1";
  const sharedImageUri = firstParam(raw.sharedImageUri);
  const sharedNotes = decodeShareParam(raw.notes);

  const presetDirection: ChequeDirection | null =
    paramDirection === "given" || paramDirection === "received"
      ? paramDirection
      : null;

  const [step, setStep] = useState(presetDirection ? 1 : 0);
  const [direction, setDirection] = useState<ChequeDirection | null>(
    presetDirection,
  );
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: paramAmount,
    currency: preferred,
  });
  const [contactId, setContactId] = useState(paramContactId);
  const [issuedBy, setIssuedBy] = useState("");
  const [maturityDays, setMaturityDays] = useState("30");
  const [notes, setNotes] = useState(sharedNotes);
  const [photo, setPhoto] = useState<LocalMedia | null>(() =>
    sharedImageUri
      ? {
          uri: sharedImageUri,
          kind: "image",
          mimeType: "image/jpeg",
          fileName: "shared-cheque.jpg",
        }
      : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);

  const directionMeta = DIRECTIONS.find((d) => d.value === direction);

  const selectedBank = useMemo(
    () => getBankByCode(bankCode) ?? null,
    [bankCode],
  );
  const bankName = selectedBank?.name ?? "";
  const canPickBranch = bankHasBranches(bankCode);

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );

  const maturityPreview = useMemo(() => {
    const days = parseInt(maturityDays, 10);
    if (!days || days < 1) return null;
    return format(addDays(new Date(), days), "d MMM yyyy");
  }, [maturityDays]);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSelectDirection(next: ChequeDirection) {
    setDirection(next);
    clearField("direction");
    setStep(1);
  }

  async function handleSubmit() {
    if (!user || !direction) return;
    const result = parseForm(addChequeSchema, {
      direction,
      chequeNumber,
      bankName,
      branch: branch || undefined,
      amount: money.amount,
      maturityDays,
      contactId,
      issuedBy: issuedBy || undefined,
      notes: notes || undefined,
    });
    if (result.success && !bankCode) {
      setErrors({ bankName: "Select a bank." });
      toast.error("Select a bank.");
      return;
    }
    if (!result.success) {
      setErrors(result.errors);
      toast.error(
        Object.values(result.errors)[0] ?? "Check the highlighted fields.",
      );
      return;
    }

    try {
      await withLoading(async () => {
        const data = result.data;
        const now = Timestamp.now();
        const maturity = Timestamp.fromDate(
          addDays(new Date(), data.maturityDays),
        );
        const issuer =
          data.issuedBy?.trim() || selectedContact?.displayName || "Unknown";

        let photoUrl: string | null = null;
        if (photo) {
          const ext = extensionForMedia(photo);
          photoUrl = await uploadLocalMedia(
            photo,
            `cheques/${user.uid}/${Date.now()}.${ext}`,
          );
        }

        const id = await createCheque(user.uid, {
          direction: data.direction,
          chequeNumber: data.chequeNumber,
          bankName: data.bankName,
          bankCode,
          branch: data.branch || null,
          amount: data.amount,
          currency: money.currency,
          counterpartyContactId: data.contactId,
          issuedBy: issuer,
          issueDate: now,
          maturityDate: maturity,
          photoUrl,
          gemId: paramGemId,
          apRecordId: paramApRecordId,
          billId: paramBillId,
          notes: data.notes || null,
        });

        if (markSold && paramGemId) {
          void updateGemLifecycle(
            paramGemId,
            user.uid,
            { outcome: "sold" },
            `Sold on cheque`,
            {
              soldPrice: data.amount,
              soldPriceCurrency: money.currency,
            },
          ).catch(() => {
            toast.error("Cheque saved, but gem sold status may still be syncing.");
          });
          void queryClient.invalidateQueries({ queryKey: ["gems"] });
          void queryClient.invalidateQueries({
            queryKey: ["gem", paramGemId],
          });
        }

        if (paramBillId) {
          const settle = parseFloat(settleAmount || String(data.amount));
          if (settle > 0) {
            void recordBillPayment(user.uid, paramBillId, settle, {
              paymentMethod: "cheque",
              notes: `Cheque ${data.chequeNumber}`,
            });
            void queryClient.invalidateQueries({ queryKey: ["bills"] });
            void queryClient.invalidateQueries({
              queryKey: ["bill", paramBillId],
            });
            void queryClient.invalidateQueries({ queryKey: ["payments"] });
            void queryClient.invalidateQueries({ queryKey: ["transactions"] });
          }
        }

        if (paramApRecordId && confirmApSent) {
          await apPaymentSent({
            apId: paramApRecordId,
            method: "cheque",
            amount: data.amount,
            chequeId: id,
          });
          await queryClient.invalidateQueries({ queryKey: ["ap"] });
        }

        if (paramApRecordId && confirmApReceived) {
          await apPaymentReceived(paramApRecordId, {
            method: "cheque",
            chequeId: id,
          });
          await queryClient.invalidateQueries({ queryKey: ["ap"] });
          await queryClient.invalidateQueries({ queryKey: ["transactions"] });
          await queryClient.invalidateQueries({ queryKey: ["money"] });
        }

        await queryClient.invalidateQueries({ queryKey: ["cheques"] });
        toast.success(
          markSold
            ? "Cheque saved · gem marked sold"
            : paramBillId
              ? "Cheque saved and bill payment recorded."
              : confirmApReceived
                ? "Cheque saved and AP payment confirmed."
                : confirmApSent
                  ? "Cheque saved and payment marked sent."
                  : "Cheque added to your tracker.",
        );

        if (paramBillId) {
          replaceWithAnchor(
            `/(marketplace)/(tabs)/workspace/bills/${paramBillId}` as never,
          );
        } else if (paramApRecordId && (confirmApSent || confirmApReceived)) {
          replaceWithAnchor(
            `/(marketplace)/(tabs)/workspace/ap/${paramApRecordId}` as never,
          );
        } else {
          replaceWithAnchor(
            `/(marketplace)/(tabs)/workspace/cheques/${id}` as never,
          );
        }
      }, "Adding cheque…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not save cheque."));
    }
  }

  if (!user) {
    return (
      <SignInPrompt
        title="Track your cheques"
        message="Sign in to add post-dated cheques and follow maturity dates."
      />
    );
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title={step === 0 ? "Direction" : "Add cheque"}
        closeIcon
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
                onPress={
                  presetDirection ? undefined : () => setStep(0)
                }
              />
            ) : null}

            <FormSection title="Cheque details">
              <Input
                label="Cheque number"
                value={chequeNumber}
                onChangeText={(v) => {
                  setChequeNumber(v);
                  clearField("chequeNumber");
                }}
                placeholder="e.g. 001234"
                leftIcon="money-check-dollar"
                error={errors.chequeNumber}
              />
              <BankSelectField
                label="Bank"
                bankCode={bankCode}
                bankName={bankName}
                onPress={() => setBankSheetOpen(true)}
                error={errors.bankName}
              />
              <BranchSelectField
                label="Branch"
                bankCode={bankCode}
                branchName={branch || null}
                onPress={() => setBranchSheetOpen(true)}
                error={errors.branch}
                disabled={!canPickBranch}
              />
              <CurrencyAmountField
                label="Amount"
                value={money}
                onChange={(next) => {
                  setMoney(next);
                  clearField("amount");
                }}
                error={errors.amount}
              />
              <MaskedInput
                label="Maturity in days"
                mode="custom"
                mask="999"
                value={maturityDays}
                onChangeText={(v) => {
                  setMaturityDays(v);
                  clearField("maturityDays");
                }}
                keyboardType="number-pad"
                placeholder="30"
                leftIcon="event"
                error={errors.maturityDays}
              />
              {maturityPreview ? (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Matures {maturityPreview}
                </Text>
              ) : null}
            </FormSection>

            <FormSection title="Counterparty">
              <ContactPicker
                label="Contact"
                contacts={contacts}
                value={contactId}
                error={errors.contactId}
                allowedBusinessKinds={["traders", "lapidaries"]}
                onChange={(id) => {
                  setContactId(id);
                  clearField("contactId");
                  const c = contacts.find((x) => x.id === id);
                  if (c && !issuedBy) setIssuedBy(c.displayName);
                }}
              />
              <Input
                label="Issued by"
                value={issuedBy}
                onChangeText={setIssuedBy}
                placeholder={selectedContact?.displayName ?? "Name on cheque"}
                leftIcon="person"
                error={errors.issuedBy}
              />
            </FormSection>

            <FormSection title="Cheque photo">
              <MediaField
                variant="row"
                value={photo}
                onChange={setPhoto}
                emptyTitle="Add cheque photo"
              />
            </FormSection>

            <FormSection>
              <Input
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                style={styles.notes}
                placeholder="Optional"
                leftIcon="notes"
                error={errors.notes}
              />
            </FormSection>

            {direction ? (
              <ChequePreviewCard
                direction={direction}
                chequeNumber={chequeNumber}
                bankName={bankName}
                bankCode={bankCode}
                branch={branch}
                amount={money.amount}
                issuedBy={issuedBy || selectedContact?.displayName || ""}
                maturityDateLabel={maturityPreview}
              />
            ) : null}
          </ThemedScrollView>

          <FormFooter
            title="Save cheque"
            icon="shield"
            onPress={handleSubmit}
            secondaryTitle={presetDirection ? undefined : "Back"}
            onSecondaryPress={
              presetDirection ? undefined : () => setStep(0)
            }
          />
        </>
      )}

      <BankPickerSheet
        visible={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        value={bankCode}
        onSelect={(bank) => {
          setBankCode(bank.code);
          setBranch("");
          clearField("bankName");
          clearField("branch");
        }}
      />
      <BranchPickerSheet
        visible={branchSheetOpen}
        onClose={() => setBranchSheetOpen(false)}
        bankCode={bankCode}
        value={branch || null}
        onSelect={(b) => {
          setBranch(b.name);
          clearField("branch");
        }}
      />
    </View>
  );
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
    gap: Spacing.lg,
  },
  hint: { ...Typography.bodySmall, marginTop: -4 },
  notes: { minHeight: 72, textAlignVertical: "top", paddingTop: 12 },
});
