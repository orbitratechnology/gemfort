import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ChipSelect } from "@/components/ui/chip-select";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactPicker } from "@/components/workspace/contact-picker";
import type { PartySelection } from "@/components/workspace/contact-picker-sheet";
import { GemPickerSheet, GemSelectField } from "@/components/workspace/gem-picker-sheet";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { subscribeContacts, subscribeGems } from "@/features/workspace/firestore-subscriptions";
import {
  createGemTransferRequest,
  recordGemSale,
} from "@/features/workspace/gem-transfer-api";
import { gemActionAvailability } from "@/features/workspace/gem-lifecycle";
import { fetchContacts, fetchGems } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { convertToBaseSync } from "@/lib/exchange-rates";
import { parseForm, recordSaleSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";

type PaymentMethod = "transfer" | "cash" | "cheque";

const METHODS: { value: PaymentMethod; label: string; icon: IconName }[] = [
  { value: "transfer", label: "Transfer", icon: "account-balance" },
  { value: "cash", label: "Cash", icon: "payments" },
  { value: "cheque", label: "Cheque", icon: "cheque" },
];

export default function RecordSaleScreen() {
  const { gemId: gemIdParam } = useLocalSearchParams<{ gemId?: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatFace, rates } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();

  const [selectedGemId, setSelectedGemId] = useState<string | null>(
    gemIdParam ?? null,
  );
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [price, setPrice] = useState<CurrencyAmountValue>({
    amount: "",
    currency: preferred,
  });
  const [buyerContactId, setBuyerContactId] = useState("");
  const [buyerParty, setBuyerParty] = useState<PartySelection | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const sellable = useMemo(
    () => gems.filter((g) => gemActionAvailability(g).mark_sold),
    [gems],
  );
  const gem = useMemo(
    () => gems.find((g) => g.id === selectedGemId) ?? null,
    [gems, selectedGemId],
  );
  const buyerContact = useMemo(
    () => contacts.find((c) => c.id === buyerContactId) ?? null,
    [contacts, buyerContactId],
  );
  const buyerLabel =
    buyerParty?.label?.trim() || buyerContact?.displayName?.trim() || "";
  const selectedBuyerContactId =
    buyerParty?.source === "contact"
      ? buyerParty.contactId
      : buyerParty?.source === "business"
        ? buyerParty.linkedContactId ?? buyerContactId
        : buyerContactId;
  const isTraderProfile = buyerParty?.source === "business";

  const salePrice = parseFloat(price.amount) || 0;
  const costBasis = gem?.totalCost ?? 0;
  const saleBase =
    rates && salePrice > 0
      ? (() => {
          try {
            return convertToBaseSync(salePrice, price.currency, rates);
          } catch {
            return price.currency === "LKR" ? salePrice : null;
          }
        })()
      : price.currency === "LKR"
        ? salePrice
        : null;
  const netProfitBase = saleBase != null ? saleBase - costBasis : null;
  const roi =
    netProfitBase != null && costBasis > 0
      ? ((netProfitBase / costBasis) * 100).toFixed(1)
      : "0.0";

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleConfirm() {
    if (!user) return;
    const result = parseForm(recordSaleSchema, {
      gemId: selectedGemId ?? "",
      price: price.amount,
      buyer: buyerLabel || undefined,
      method,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(
        Object.values(result.errors)[0] ?? "Check the highlighted fields.",
      );
      return;
    }
    if (!gem) {
      toast.error("Choose which stone you are selling.");
      return;
    }
    if (!selectedBuyerContactId) {
      setErrors((previous) => ({
        ...previous,
        buyer: "Select a Trader or Contact.",
      }));
      toast.error("Select a Trader or Contact.");
      return;
    }

    try {
      await withLoading(async () => {
        const data = result.data;
        const paymentMethod =
          data.method === "transfer" ? "bank_transfer" : data.method;
        if (buyerParty?.source === "business") {
          await createGemTransferRequest({
            gemId: gem.id,
            recipientBusinessId: buyerParty.businessId,
            recipientContactId: selectedBuyerContactId,
            recipientName: buyerLabel,
            amount: data.price,
            currency: price.currency,
            paymentMethod,
          });
        } else {
          await recordGemSale({
            gemId: gem.id,
            recipientContactId: selectedBuyerContactId,
            recipientName: buyerLabel,
            amount: data.price,
            currency: price.currency,
            paymentMethod,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
        toast.success(
          isTraderProfile
            ? `${gem.sku} sale recorded — waiting for trader acceptance.`
            : `${gem.sku} sale recorded to ${buyerLabel}.`,
        );
        router.back();
      }, isTraderProfile ? "Recording trader sale…" : "Recording sale…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not record the sale."));
    }
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader title="Record sale" closeIcon />

      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <ScreenInset style={styles.stack}>
          <GemSelectField
            label="Stone"
            gem={gem}
            placeholder="Select a gem"
            onPress={() => setGemSheetOpen(true)}
            error={errors.gemId}
          />
          {gem ? (
            <Text style={[styles.gemMeta, { color: colors.textMuted }]}>
              Cost basis {formatBase(costBasis)}
            </Text>
          ) : null}
        </ScreenInset>

        <FormSection title="Sale details">
          <CurrencyAmountField
            label="Final sale price"
            value={price}
            onChange={(next) => {
              setPrice(next);
              clearField("price");
            }}
            error={errors.price}
          />
          <ContactPicker
            label="Sold to"
            contacts={contacts}
            value={buyerContactId}
            onChange={(id) => {
              setBuyerContactId(id);
              clearField("buyer");
            }}
            onPartyChange={setBuyerParty}
            allowedBusinessKinds={["traders"]}
            emptyHint="Select a Trader or Contact."
            error={errors.buyer}
          />
          <ChipSelect
            label="Payment method"
            layout="stack"
            options={METHODS}
            value={method}
            onChange={(v) => {
              setMethod(v);
              clearField("method");
            }}
            error={errors.method}
          />
        </FormSection>

        {gem && salePrice > 0 ? (
          <ScreenInset>
            <View
              style={[styles.projection, { backgroundColor: colors.primary }]}
            >
              <Text
                style={[styles.projHeading, { color: colors.onPrimary + "B3" }]}
              >
                Projection
              </Text>
              <View style={styles.projRow}>
                <View style={styles.projCell}>
                  <Text
                    style={[styles.projLabel, { color: colors.onPrimary + "99" }]}
                  >
                    Cost
                  </Text>
                  <Text
                    style={[styles.projValue, { color: colors.onPrimary }]}
                  >
                    {formatBase(costBasis)}
                  </Text>
                </View>
                <View style={styles.projCell}>
                  <Text
                    style={[styles.projLabel, { color: colors.onPrimary + "99" }]}
                  >
                    Profit
                  </Text>
                  <Text
                    style={[
                      styles.projValue,
                      {
                        color:
                          (netProfitBase ?? 0) >= 0
                            ? colors.onPrimary
                            : colors.errorContainer,
                      },
                    ]}
                  >
                    {netProfitBase != null
                      ? `${netProfitBase >= 0 ? "+" : ""}${formatBase(netProfitBase)}`
                      : formatFace(salePrice, price.currency)}
                  </Text>
                </View>
                <View style={styles.projCell}>
                  <Text
                    style={[styles.projLabel, { color: colors.onPrimary + "99" }]}
                  >
                    ROI
                  </Text>
                  <Text
                    style={[styles.projValue, { color: colors.onPrimary }]}
                  >
                    {roi}%
                  </Text>
                </View>
              </View>
            </View>
          </ScreenInset>
        ) : null}
      </ThemedScrollView>

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={sellable}
        value={selectedGemId ?? ""}
        title="Select gem"
        emptyHint="No gems are currently eligible to record as sold."
        initialTab="on_sale"
        onSelect={(g) => {
          setSelectedGemId(g.id);
          clearField("gemId");
        }}
      />

      <FormFooter
        title="Record sale"
        icon="price-check"
        onPress={handleConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  stack: { gap: Spacing.md },
  gemMeta: { ...Typography.bodySmall },
  projection: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: 12,
  },
  projHeading: { ...Typography.labelMd, fontWeight: "600" },
  projRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  projCell: { flex: 1, gap: 4 },
  projLabel: { ...Typography.caption },
  projValue: {
    ...Typography.headlineSmMobile,
    fontVariant: ["tabular-nums"],
  },
});
