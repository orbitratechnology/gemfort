import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import {
  Accent,
  BandLink,
  DetailBand,
  DetailRows,
  IconBubble,
  StatusChip,
  TotalRow,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { FormSection } from "@/components/ui/form-section";
import { TRIP_STATUS_ACCENT } from "@/components/workspace/trip-status-tabs";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import { resolveCurrencyCode } from "@/constants/currencies";
import { TRIP_STATUS_LABELS } from "@/constants/trip-options";
import { subscribeTrip } from "@/features/workspace/firestore-subscriptions";
import { formatTripDates } from "@/features/workspace/trip-utils";
import { fetchTrip } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { haptics } from "@/lib/haptics";
import { parseAmountInput } from "@/lib/money/mask";

type TripBudgetBandProps = {
  /** Formatted budget, or null when none is set. */
  budgetLabel: string | null;
  /** Expenses + gem purchases. */
  spentLabel: string;
  expensesLabel: string;
  /** Gem purchase spend; omit to hide the row (selling-only trips). */
  purchasesLabel?: string | null;
  remainingNegative: boolean;
  percent: number;
  /** Face amount currently stored on the trip. */
  budgetAmount: number;
  budgetCurrency: string;
  onSaveBudget: (next: {
    budget: number;
    budgetCurrency: string;
  }) => void | Promise<void>;
};

/**
 * Budget band on the trip detail screen: usage meter, budget / expenses /
 * purchases rows and the total spent, with an edit sheet behind the band link.
 */
export function TripBudgetBand({
  budgetLabel,
  spentLabel,
  expensesLabel,
  purchasesLabel,
  remainingNegative,
  percent,
  budgetAmount,
  budgetCurrency,
  onSaveBudget,
}: TripBudgetBandProps) {
  const { colors } = useAppTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<CurrencyAmountValue>({
    amount: budgetAmount > 0 ? String(budgetAmount) : "",
    currency: resolveCurrencyCode(budgetCurrency),
  });
  const [saving, setSaving] = useState(false);
  const hasBudget = budgetLabel != null;
  // Ink while comfortably inside budget; amber near the cap, rose over it.
  const meterAccent = remainingNegative
    ? Accent.rose
    : percent > 90
      ? Accent.amber
      : colors.onSurface;

  function openEdit() {
    setDraft({
      amount: budgetAmount > 0 ? String(budgetAmount) : "",
      currency: resolveCurrencyCode(budgetCurrency),
    });
    setEditOpen(true);
  }

  async function handleSave() {
    const parsed = parseAmountInput(draft.amount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    await Promise.resolve()
      .then(async () => {
        await onSaveBudget({
          budget: parsed,
          budgetCurrency: draft.currency,
        });
        setEditOpen(false);
      })
      .catch(() => {
        // Parent surfaces the error toast.
      })
      .finally(() => {
        setSaving(false);
      });
  }

  const rows: ({ key: string } & DetailRowProps)[] = [
    {
      key: "budget",
      icon: "account-balance-wallet",
      label: "Budget",
      value: budgetLabel ?? "Not set",
      onPress: haptics.wrap("light", openEdit),
    },
    {
      key: "expenses",
      icon: "receipt",
      label: "Expenses",
      value: expensesLabel,
    },
    ...(purchasesLabel != null
      ? [
          {
            key: "purchases",
            icon: "diamond" as const,
            label: "Gem purchases",
            value: purchasesLabel,
          },
        ]
      : []),
  ];

  return (
    <>
      <DetailBand
        title="Budget"
        trailing={
          <BandLink
            label={hasBudget ? "Edit budget" : "Set budget"}
            onPress={haptics.wrap("light", openEdit)}
          />
        }
      >
        {hasBudget ? (
          <View
            style={styles.meter}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${percent}% of budget used`}
            accessibilityValue={{ min: 0, max: 100, now: Math.min(100, percent) }}
          >
            <View style={styles.meterLabels}>
              <Text style={[styles.meterLabel, { color: colors.onSurfaceVariant }]}>
                Budget used
              </Text>
              <Text style={[styles.meterPct, { color: meterAccent }]}>
                {percent}%
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, percent)}%`,
                    backgroundColor: meterAccent,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        <View>
          <DetailRows rows={rows} />
          <TotalRow
            label="Total spent"
            value={spentLabel}
            accent={remainingNegative ? Accent.rose : undefined}
          />
        </View>
      </DetailBand>

      <BottomSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Update budget"
        footer={
          <Button
            title="Save budget"
            icon="check"
            loading={saving}
            onPress={handleSave}
          />
        }
      >
        <View style={styles.editBody}>
          <CurrencyAmountField
            label="Trip budget"
            value={draft}
            onChange={setDraft}
            placeholder="0"
          />
        </View>
      </BottomSheet>
    </>
  );
}

/**
 * Compact "which trip is this for" section at the top of the trip add flows.
 * Reads the same live `["trip", id]` cache as the trip detail screen.
 */
export function TripContextSummary({ tripId }: { tripId: string | undefined }) {
  const { colors } = useAppTheme();
  const { data: trip } = useFirestoreLiveQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip(tripId!),
    subscribe: (onData, onError) => subscribeTrip(tripId!, onData, onError),
    enabled: !!tripId,
  });

  if (!trip) return null;

  const accent = TRIP_STATUS_ACCENT[trip.status];
  const place = [trip.destinationCity, trip.destinationCountry]
    .filter((part): part is string => !!part?.trim())
    .join(", ");

  return (
    <FormSection>
      <View style={styles.context}>
        <IconBubble icon="flight" accent={accent} size={40} />
        <View style={styles.contextCopy}>
          <Text style={[styles.contextTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {trip.tripName}
          </Text>
          <Text
            style={[styles.contextSub, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {[place, formatTripDates(trip)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <StatusChip label={TRIP_STATUS_LABELS[trip.status]} accent={accent} size="sm" />
      </View>
    </FormSection>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  meter: { gap: Spacing.sm },
  meterLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meterLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 13 },
  meterPct: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  editBody: { gap: Spacing.md, paddingBottom: Spacing.sm },
  context: { flexDirection: "row", alignItems: "center", gap: 12 },
  contextCopy: { flex: 1, minWidth: 0, gap: 1 },
  contextTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  contextSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
});
