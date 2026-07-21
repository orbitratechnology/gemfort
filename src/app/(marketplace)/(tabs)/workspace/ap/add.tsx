import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
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
import { resolveCurrencyCode } from "@/constants/currencies";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { createApRequest } from "@/features/workspace/ap-lifecycle-service";
import {
  fetchContacts,
  fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { WorkspaceGem } from "@/types";

type LineDraft = {
  gemId: string;
  price: CurrencyAmountValue;
};

function defaultPrice(
  gem: WorkspaceGem,
  preferred: CurrencyAmountValue["currency"],
): CurrencyAmountValue {
  const n = gem.askingPrice ?? gem.acquisitionCost ?? 0;
  const currency = resolveCurrencyCode(
    gem.askingPriceCurrency ?? gem.acquisitionCurrency ?? preferred,
    preferred,
  );
  return { amount: n > 0 ? String(n) : "", currency };
}

export default function AddApScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const { gemId: preselected } = useLocalSearchParams<{ gemId?: string }>();
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [holderId, setHolderId] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const availableGems = useMemo(
    () =>
      gems.filter(
        (g) =>
          !["on_ap", "sold"].includes(g.status) &&
          !lines.some((l) => l.gemId === g.id),
      ),
    [gems, lines],
  );

  useEffect(() => {
    if (!preselected || gems.length === 0) return;
    setLines((prev) => {
      if (prev.some((l) => l.gemId === preselected)) return prev;
      const gem = gems.find((g) => g.id === preselected);
      if (!gem) return prev;
      return [{ gemId: gem.id, price: defaultPrice(gem, preferred) }];
    });
  }, [preselected, gems, preferred]);

  const holder = contacts.find((c) => c.id === holderId);

  function addGem(gem: WorkspaceGem) {
    setLines((prev) => [
      ...prev,
      { gemId: gem.id, price: defaultPrice(gem, preferred) },
    ]);
    setErrors((e) => {
      if (!e.gems) return e;
      const next = { ...e };
      delete next.gems;
      return next;
    });
  }

  function removeGem(gemId: string) {
    setLines((prev) => prev.filter((l) => l.gemId !== gemId));
  }

  function setPrice(gemId: string, price: CurrencyAmountValue) {
    setLines((prev) =>
      prev.map((l) => (l.gemId === gemId ? { ...l, price } : l)),
    );
  }

  async function handleSubmit() {
    if (!user) return;
    const next: Record<string, string> = {};
    if (lines.length === 0) next.gems = "Add at least one gem.";
    if (!holderId) next.holderId = "Select an AP holder.";
    if (holder && !holder.linkedBusinessId) {
      next.holderId =
        "Holder must be a GemFort trader linked by phone. Pick a trader from the directory.";
    }
    for (const line of lines) {
      const price = parseFloat(line.price.amount);
      if (!line.price.amount.trim() || Number.isNaN(price) || price <= 0) {
        next[`price-${line.gemId}`] = "Enter a valid AP price.";
      }
    }
    if (Object.keys(next).length) {
      setErrors(next);
      toast.error(Object.values(next)[0]);
      return;
    }

    setLoading(true);
    try {
      const id = await createApRequest({
        receiverContactId: holderId,
        receiverBusinessId: holder?.linkedBusinessId ?? null,
        expectedDurationDays: parseInt(days, 10) || 30,
        items: lines.map((l) => ({
          gemId: l.gemId,
          agreedPrice: parseFloat(l.price.amount),
          currency: l.price.currency,
        })),
      });
      toast.success("AP request sent");
      router.replace(`/(marketplace)/(tabs)/workspace/ap/${id}`);
    } catch (e) {
      toast.error(friendlyError(e, "Could not send AP request."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Give on AP" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSection title="Gems">
          {lines.map((line) => {
            const gem = gems.find((g) => g.id === line.gemId);
            return (
              <View
                key={line.gemId}
                style={[
                  styles.lineCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.lineHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.lineTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {gem
                        ? gem.variety?.trim() ||
                          formatGemType(gem.gemType) ||
                          gem.sku
                        : line.gemId.slice(0, 8)}
                    </Text>
                    <Text
                      style={[styles.lineSub, { color: colors.textMuted }]}
                    >
                      {gem
                        ? `${gem.sku} · ${gem.currentWeight} ct`
                        : "Gem"}
                      {gem?.acquisitionCost
                        ? ` · cost ${formatCurrency(gem.acquisitionCost)}`
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeGem(line.gemId)}
                    accessibilityLabel="Remove gem"
                    hitSlop={8}
                  >
                    <Icon name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
                <CurrencyAmountField
                  label="AP price"
                  value={line.price}
                  onChange={(next) => setPrice(line.gemId, next)}
                  error={errors[`price-${line.gemId}`]}
                />
              </View>
            );
          })}
          <GemSelectField
            label={lines.length ? "Add another gem" : "Gem"}
            gem={null}
            placeholder="Select a gem"
            onPress={() => setGemSheetOpen(true)}
            error={errors.gems}
          />
        </FormSection>

        <FormSection title="Terms">
          <Input
            label="Expected Days"
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
            leftIcon="schedule"
          />
        </FormSection>

        <FormSection title="AP holder">
          <ContactPicker
            label="AP Holder"
            contacts={contacts}
            value={holderId}
            onChange={(id) => {
              setHolderId(id);
              setErrors((e) => {
                if (!e.holderId) return e;
                const next = { ...e };
                delete next.holderId;
                return next;
              });
            }}
            allowedBusinessKinds={["traders"]}
            emptyHint="Pick a GemFort trader (required for Accept/Reject)."
            error={errors.holderId}
          />
          {holder && !holder.linkedBusinessId ? (
            <Text style={[styles.warn, { color: colors.error }]}>
              This contact is not linked to a GemFort trader. Choose a trader
              from the directory.
            </Text>
          ) : null}
        </FormSection>

        <ScreenInset>
          <Button
            title="Send AP request"
            icon="handshake"
            loading={loading}
            onPress={handleSubmit}
          />
        </ScreenInset>
      </ThemedScrollView>

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={availableGems}
        value=""
        title="Select gem for AP"
        emptyHint="No available gems. Add a gem or free one from another AP first."
        onSelect={addGem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.section },
  lineCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  lineTitle: { ...Typography.bodyMd, fontWeight: "600" },
  lineSub: { ...Typography.caption, marginTop: 2 },
  warn: { ...Typography.bodySmall, marginTop: Spacing.sm },
});
