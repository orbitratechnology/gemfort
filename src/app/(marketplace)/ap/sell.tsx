import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import {
  Accent,
  DetailBand,
  DetailRows,
  TotalRow,
} from "@/components/ui/detail-kit";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { CalendarSyncToggle } from "@/components/workspace/calendar-sync-toggle";
import {
  ApSellPartyStep,
  ApSellStepRail,
} from "@/components/workspace/ap-sell-party-step";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import {
  fetchBusinessByOwnerUid,
  fetchBusinesses,
} from "@/features/marketplace/marketplace-service";
import {
  fetchApRecordsForUser,
  recordApGemSale,
} from "@/features/workspace/ap-lifecycle-service";
import {
  subscribeApRecordsForUser,
  subscribeBusinessByOwnerUid,
  subscribeGem,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  gemPrimaryPhotoUrl,
  resolveBusinessPhotoByOwnerUid,
} from "@/features/workspace/party-photo";
import { fetchGem } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { friendlyError } from "@/lib/errors";
import { commitmentDeepLink } from "@/features/calendar-sync/links";
import { makeSyncCommitment } from "@/features/calendar-sync/commitments";
import { writeCommitmentToDevice } from "@/features/calendar-sync/sync-item";
import { haptics } from "@/lib/haptics";
import { formatCurrency } from "@/lib/utils";
import { parseForm, sellApGemSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type SellStep = 0 | 1 | 2;

export default function ApSellScreen() {
  const raw = useLocalSearchParams<{ apId?: string; gemId?: string }>();
  const apId = firstParam(raw.apId);
  const gemId = firstParam(raw.gemId);
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [step, setStep] = useState<SellStep>(0);
  const [ownerReceives, setOwnerReceives] = useState("");
  const [receiverKeeps, setReceiverKeeps] = useState("");
  const [soldToName, setSoldToName] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("14");
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [reminderSyncEnabled, setReminderSyncEnabled] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [didPrefill, setDidPrefill] = useState(false);

  const { data: records = [], isLoading } = useFirestoreLiveQuery({
    queryKey: ["ap", "detail", user?.uid],
    queryFn: () => fetchApRecordsForUser(user!.uid),
    subscribe: (onData, onError) =>
      subscribeApRecordsForUser(user!.uid, onData, onError),
    enabled: !!user,
  });

  const ap = records.find((r) => r.id === apId);
  const line = ap?.items?.find((i) => i.gemId === gemId);

  const { data: gem = null } = useFirestoreLiveQuery({
    queryKey: ["ap", "sell-gem", gemId],
    queryFn: () => fetchGem(gemId),
    subscribe: (onData, onError) => subscribeGem(gemId, onData, onError),
    enabled: !!gemId,
  });
  const gemPhoto = gemPrimaryPhotoUrl(gem);

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!ap,
  });

  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user,
  });

  if (!didPrefill && line) {
    setDidPrefill(true);
    if (line.agreedPrice > 0) {
      setOwnerReceives(String(line.agreedPrice));
    }
  }

  const senderName = ap?.senderName?.trim() || "Sender";
  const senderPhoto = ap
    ? resolveBusinessPhotoByOwnerUid(ap.senderUid, businesses)
    : null;
  const youName = myBusiness?.businessName?.trim() || "Your Business";
  const youPhoto = user?.photoURL ?? null;
  const gemLabel = line?.gemLabel ?? "Gem";
  const currency = line?.currency || "LKR";

  const ownerN = parseFloat(ownerReceives) || 0;
  const keepN = parseFloat(receiverKeeps) || 0;
  const totalN = ownerN + keepN;

  const canContinueSender = ownerReceives.trim().length > 0 && ownerN > 0;
  const canContinueYou = keepN >= 0;

  const stepTitle = useMemo(() => {
    if (step === 0) return senderName;
    if (step === 1) return youName;
    return gemLabel;
  }, [step, senderName, youName, gemLabel]);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function goBack() {
    if (step === 0) {
      router.back();
      return;
    }
    haptics.selection();
    setStep((s) => (s - 1) as SellStep);
  }

  function goNext() {
    if (step === 0) {
      if (!canContinueSender) {
        setErrors({ ownerReceives: "Enter amount for sender" });
        toast.error("Enter amount for sender");
        return;
      }
      clearField("ownerReceives");
      haptics.selection();
      setStep(1);
      return;
    }
    if (step === 1) {
      const keepValue = receiverKeeps.trim() === "" ? "0" : receiverKeeps;
      if (keepValue !== receiverKeeps) setReceiverKeeps(keepValue);
      const n = parseFloat(keepValue);
      if (Number.isNaN(n) || n < 0) {
        setErrors({ receiverKeeps: "Enter your amount" });
        toast.error("Enter your amount");
        return;
      }
      clearField("receiverKeeps");
      haptics.selection();
      setStep(2);
    }
  }

  const [confirming, handleConfirm] = usePendingAction(async () => {
    if (!ap || !line || !user) return;
    const keepValue = receiverKeeps.trim() === "" ? "0" : receiverKeeps;
    const result = parseForm(sellApGemSchema, {
      ownerReceives,
      receiverKeeps: keepValue,
      soldToName: soldToName || undefined,
      paymentDueDays,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }

    const soldPrice =
      result.data.ownerReceives + result.data.receiverKeeps;
    const due = new Date();
    due.setDate(due.getDate() + result.data.paymentDueDays);

    try {
      await recordApGemSale({
        apId: ap.id,
        gemId: line.gemId,
        soldPrice,
        ownerReceives: result.data.ownerReceives,
        soldToName: result.data.soldToName,
        paymentDueDateIso: due.toISOString(),
      });
      if (calendarSyncEnabled) {
        const commitment = makeSyncCommitment({
          surface: "calendar",
          sourceType: "ap",
          sourceId: ap.id,
          title: "AP payment due",
          date: due,
          url: commitmentDeepLink("ap", ap.id),
        });
        if ((await writeCommitmentToDevice(commitment)) === false) {
          toast.info("Sale recorded, but its calendar entry could not be added.");
        }
      }
      if (reminderSyncEnabled) {
        const commitment = makeSyncCommitment({
          surface: "reminder",
          sourceType: "ap",
          sourceId: ap.id,
          title: "AP payment due",
          date: due,
          url: commitmentDeepLink("ap", ap.id),
        });
        if ((await writeCommitmentToDevice(commitment)) === false) {
          toast.info("Sale recorded, but its reminder could not be added.");
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["ap"] });
      await queryClient.invalidateQueries({ queryKey: ["gems"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["money"] });
      haptics.success();
      toast.success("Sale recorded");
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, "Could not record sale."));
    }
  });

  if (!user) {
    return (
      <SignInPrompt
        title="Record an AP sale"
        message="Sign in to split sale proceeds and close stones on approval."
      />
    );
  }

  if (isLoading || !ap || !line) {
    return (
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <StackHeader
          title="Sell"
          closeIcon
          image={require("@/assets/images/ap-icon.png")}
        />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Gem not found on this AP."}
          </Text>
        </View>
      </View>
    );
  }

  if (ap.receiverUid !== user?.uid || line.lineStatus !== "held") {
    return (
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <StackHeader
          title="Sell"
          closeIcon
          image={require("@/assets/images/ap-icon.png")}
        />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            This gem cannot be sold on AP right now.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title={stepTitle}
        closeIcon
        image={require("@/assets/images/ap-icon.png")}
      />
      <ApSellStepRail step={step} />

      {step === 0 ? (
        <ThemedScrollView
          style={{ flex: 0, maxHeight: windowHeight * 0.62 }}
          contentContainerStyle={styles.stepScroll}
          keyboardShouldPersistTaps="handled"
        >
          <ApSellPartyStep
            partyName={senderName}
            partyPhotoUrl={senderPhoto}
            flowIcon="call-made"
            gemUri={gemPhoto}
            gem={gem}
            gemLabel={gemLabel}
            amount={ownerReceives}
            onChangeAmount={(v) => {
              setOwnerReceives(v);
              clearField("ownerReceives");
            }}
            currencyLabel={currency}
            error={errors.ownerReceives}
          />
        </ThemedScrollView>
      ) : null}

      {step === 1 ? (
        <ThemedScrollView
          style={{ flex: 0, maxHeight: windowHeight * 0.62 }}
          contentContainerStyle={styles.stepScroll}
          keyboardShouldPersistTaps="handled"
        >
          <ApSellPartyStep
            partyName={youName}
            partyPhotoUrl={youPhoto}
            flowIcon="account-balance-wallet"
            gemUri={gemPhoto}
            gem={gem}
            gemLabel={gemLabel}
            amount={receiverKeeps}
            onChangeAmount={(v) => {
              setReceiverKeeps(v);
              clearField("receiverKeeps");
            }}
            currencyLabel={currency}
            error={errors.receiverKeeps}
            moneyTone
          />
        </ThemedScrollView>
      ) : null}

      {step === 2 ? (
        <ThemedScrollView
          style={{ flex: 0, maxHeight: windowHeight * 0.62 }}
          contentContainerStyle={styles.confirmScroll}
          keyboardShouldPersistTaps="handled"
        >
          <DetailBand title="Sale split">
            <View style={styles.gemRow}>
              {gemPhoto || !gem ? (
                <GemThumb uri={gemPhoto} label={gemLabel} size={48} radius={12} />
              ) : (
                <GemArtwork gem={gem} artScale={0.8} style={styles.gemArt} />
              )}
              <View style={styles.gemCopy}>
                <Text
                  style={[styles.gemTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {gemLabel}
                </Text>
                <Text style={[styles.gemSub, { color: colors.onSurfaceVariant }]}>
                  Sold on AP from {senderName}
                </Text>
              </View>
            </View>
            <DetailRows
              rows={[
                {
                  key: "sender",
                  leading: (
                    <ContactAvatar name={senderName} photoUrl={senderPhoto} size={34} />
                  ),
                  label: senderName,
                  hint: "Sender receives",
                  value: formatCurrency(ownerN, currency),
                },
                {
                  key: "you",
                  icon: "account-balance-wallet",
                  accent: Accent.emerald,
                  label: youName,
                  hint: "You keep",
                  value: (
                    <Text style={[styles.keepValue, { color: Accent.emerald }]}>
                      {formatCurrency(keepN, currency)}
                    </Text>
                  ),
                },
              ]}
            />
            <TotalRow
              label="Sale price"
              value={formatCurrency(totalN, currency)}
              accent={Accent.blue}
            />
          </DetailBand>

          <FormSection title="Optional">
            <Input
              label="Sold to"
              value={soldToName}
              onChangeText={setSoldToName}
              leftIcon="person"
            />
            <MaskedInput
              label="Payment due (days)"
              mode="custom"
              mask="999"
              value={paymentDueDays}
              onChangeText={(v) => {
                setPaymentDueDays(v);
                clearField("paymentDueDays");
              }}
              keyboardType="number-pad"
              leftIcon="schedule"
              error={errors.paymentDueDays}
            />
          </FormSection>
          <FormSection>
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
        </ThemedScrollView>
      ) : null}

      <View style={{ paddingBottom: Math.max(insets.bottom, 0) }}>
        {step < 2 ? (
          <FormFooter
            title="Next"
            icon="chevron-right"
            onPress={goNext}
            disabled={step === 0 ? !canContinueSender : !canContinueYou}
            secondaryTitle="Back"
            onSecondaryPress={goBack}
          />
        ) : (
          <FormFooter
            title="Confirm sale"
            icon="check"
            loading={confirming}
            onPress={handleConfirm}
            secondaryTitle="Back"
            onSecondaryPress={goBack}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  stepScroll: {
    paddingBottom: Spacing.lg,
  },
  confirmScroll: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  gemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  gemArt: { width: 48, height: 48, borderRadius: 12, borderCurve: "continuous" },
  gemCopy: { flex: 1, minWidth: 0, gap: 2 },
  gemTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  gemSub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  keepValue: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
});
