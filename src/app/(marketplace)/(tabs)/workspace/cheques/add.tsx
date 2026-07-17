import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChipSelect } from "@/components/ui/chip-select";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
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
import {
    createCheque,
    fetchContacts,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import {
    extensionForMedia,
    uploadLocalMedia,
    type LocalMedia,
} from "@/lib/firebase/storage-service";
import { addChequeSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { ChequeDirection } from "@/types";

const DIRECTIONS = [
  {
    value: "received" as const,
    label: "Received",
    subtitle: "Payment coming to you",
    icon: "call-received" as const,
  },
  {
    value: "given" as const,
    label: "Given",
    subtitle: "Cheque you issued",
    icon: "call-made" as const,
  },
];

export default function AddChequeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    amount?: string;
    gemId?: string;
    apRecordId?: string;
    contactId?: string;
  }>();

  const [direction, setDirection] = useState<ChequeDirection>("received");
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [amount, setAmount] = useState(params.amount ?? "");
  const [contactId, setContactId] = useState(params.contactId ?? "");
  const [issuedBy, setIssuedBy] = useState("");
  const [maturityDays, setMaturityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);

  const selectedBank = useMemo(
    () => getBankByCode(bankCode) ?? null,
    [bankCode],
  );
  const bankName = selectedBank?.name ?? "";
  const canPickBranch = bankHasBranches(bankCode);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
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

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addChequeSchema, {
      direction,
      chequeNumber,
      bankName,
      branch: branch || undefined,
      amount,
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

    setLoading(true);
    try {
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
        counterpartyContactId: data.contactId,
        issuedBy: issuer,
        issueDate: now,
        maturityDate: maturity,
        photoUrl,
        gemId: params.gemId ?? null,
        apRecordId: params.apRecordId ?? null,
        notes: data.notes || null,
      });

      await queryClient.invalidateQueries({ queryKey: ["cheques"] });
      toast.success("Cheque added to your tracker.");
      router.replace(`/(marketplace)/(tabs)/workspace/cheques/${id}` as never);
    } catch (e) {
      toast.error(friendlyError(e, "Could not save cheque."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add cheque" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenInset>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Track post-dated cheques and maturity dates.
          </Text>
        </ScreenInset>

        <FormSection title="Direction">
          <ChipSelect
            layout="split"
            options={DIRECTIONS}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              clearField("direction");
            }}
            error={errors.direction}
          />
        </FormSection>

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
          <Input
            label="Amount (LKR)"
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              clearField("amount");
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="payments"
            error={errors.amount}
          />
          <Input
            label="Maturity in days"
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

        <FormSection
          title="Cheque photo"
          hint="Optional. Upload happens when you save."
        >
          <MediaField
            variant="row"
            value={photo}
            onChange={setPhoto}
            emptyTitle="Add cheque photo"
            emptySubtitle="Kept on device until you save"
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

        <ChequePreviewCard
          direction={direction}
          chequeNumber={chequeNumber}
          bankName={bankName}
          bankCode={bankCode}
          branch={branch}
          amount={amount}
          issuedBy={issuedBy || selectedContact?.displayName || ""}
          maturityDateLabel={maturityPreview}
        />
      </ThemedScrollView>

      <FormFooter
        title="Save cheque"
        icon="shield"
        loading={loading}
        onPress={handleSubmit}
      />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  lead: { ...Typography.bodyMd, lineHeight: 22 },
  hint: { ...Typography.bodySmall, marginTop: -4 },
  notes: { minHeight: 72, textAlignVertical: "top", paddingTop: 12 },
});
