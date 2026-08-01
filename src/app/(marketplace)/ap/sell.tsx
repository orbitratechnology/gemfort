import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  ApSellPartyStep,
  ApSellStepRail,
} from "@/components/workspace/ap-sell-party-step";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  fetchApRecordsForUser,
  recordApGemSale,
} from "@/features/workspace/ap-lifecycle-service";
import {
  subscribeApRecordsForUser,
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
import { friendlyError } from "@/lib/errors";
import { haptics } from "@/lib/haptics";
import { formatCurrency } from "@/lib/utils";
import { parseForm, sellApGemSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
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
  const { user, profile } = useAuth();
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

  const { data: gemPhoto = null } = useFirestoreLiveQuery({
    queryKey: ["ap", "sell-gem-photo", gemId],
    queryFn: async () => gemPrimaryPhotoUrl(await fetchGem(gemId)),
    subscribe: (onData, onError) =>
      subscribeGem(
        gemId,
        (gem) => onData(gemPrimaryPhotoUrl(gem)),
        onError,
      ),
    enabled: !!gemId,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!ap,
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
  const youName = profile?.displayName || user?.displayName || "You";
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

  async function handleConfirm() {
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
      await withLoading(async () => {
        await recordApGemSale({
          apId: ap.id,
          gemId: line.gemId,
          soldPrice,
          ownerReceives: result.data.ownerReceives,
          soldToName: result.data.soldToName,
          paymentDueDateIso: due.toISOString(),
        });
        await queryClient.invalidateQueries({ queryKey: ["ap"] });
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
        await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        await queryClient.invalidateQueries({ queryKey: ["money"] });
        haptics.success();
        toast.success("Sale recorded");
        router.back();
      }, "Recording sale…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not record sale."));
    }
  }

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
        <StackHeader title="Sell" closeIcon />
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
        <StackHeader title="Sell" closeIcon />
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
      <StackHeader title={stepTitle} closeIcon />
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
          <Animated.View
            entering={FadeIn.duration(280)}
            style={styles.confirmHero}
          >
            <GemThumb
              uri={gemPhoto}
              label={gemLabel}
              size={64}
              radius={14}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(40).duration(300)}
            style={styles.splitRow}
          >
            <View
              style={[
                styles.splitCard,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <ContactAvatar
                name={senderName}
                photoUrl={senderPhoto}
                size={52}
              />
              <Icon name="call-made" size={18} color={colors.onPrimaryContainer} />
              <Text
                style={[
                  styles.splitAmount,
                  { color: colors.onPrimaryContainer },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(ownerN, currency)}
              </Text>
            </View>

            <View
              style={[
                styles.splitCard,
                { backgroundColor: colors.successEmerald + "22" },
              ]}
            >
              <View
                style={[
                  styles.miniWallet,
                  { backgroundColor: colors.successEmerald + "33" },
                ]}
              >
                <Icon
                  name="account-balance-wallet"
                  size={26}
                  color={colors.successEmerald}
                />
              </View>
              <Icon name="payments" size={18} color={colors.successEmerald} />
              <Text
                style={[styles.splitAmount, { color: colors.successEmerald }]}
                numberOfLines={1}
              >
                {formatCurrency(keepN, currency)}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).duration(280)}
            style={[
              styles.totalPill,
              { backgroundColor: colors.surfaceContainerHighest },
            ]}
          >
            <Icon name="sell" size={18} color={colors.onSurfaceVariant} />
            <Text
              style={[styles.totalText, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {formatCurrency(totalN, currency)}
            </Text>
          </Animated.View>

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
  sheet: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  stepScroll: {
    paddingBottom: Spacing.lg,
  },
  confirmScroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
    alignItems: "center",
  },
  confirmHero: { alignItems: "center" },
  splitRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  splitCard: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  splitAmount: {
    ...Typography.bodyLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  miniWallet: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  totalText: {
    ...Typography.bodyLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
