import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  Accent,
  BandLink,
  DetailBand,
  DetailHeader,
  DetailRow,
  DetailRows,
  KeyStats,
  StatusChip,
  TitleBand,
  TotalRow,
  detailStyles,
  useCollapsingHeader,
} from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  TripDocumentKindSheet,
  TripDocumentThumb,
  TripDocumentViewer,
  TripDocumentsScanLink,
  tripDocumentKindLabel,
} from "@/components/workspace/trip-documents";
import {
  TripExpensesSheet,
  tripExpenseRow,
} from "@/components/workspace/trip-expenses-sheet";
import {
  TripGemRow,
  TripGemsSheet,
  TripSoldGemsSection,
  canSellTripGem,
} from "@/components/workspace/trip-gems-sheet";
import { TripBudgetBand } from "@/components/workspace/trip-money-cards";
import { TripFlagHero, TripRouteStrip } from "@/components/workspace/trip-hero";
import { TRIP_STATUS_ACCENT } from "@/components/workspace/trip-status-tabs";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import { TRIP_STATUS_LABELS, TRIP_TYPES } from "@/constants/trip-options";
import {
  subscribeGems,
  subscribeTrip,
  subscribeTripExpenses,
  subscribeTripGems,
} from "@/features/workspace/firestore-subscriptions";
import {
  budgetRemaining,
  budgetUsedPercent,
  canCompleteTrip,
  canStartTrip,
  computeTripSummary,
  toTripDate,
  tripBudgetBase,
  tripBudgetSpent,
  tripDurationDays,
} from "@/features/workspace/trip-utils";
import {
  addTripDocuments,
  distributeTripOverhead,
  fetchGems,
  fetchTrip,
  fetchTripExpenses,
  fetchTripGems,
  removeTripDocument,
  updateTripBudget,
  updateTripStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import type { LocalMedia } from "@/lib/firebase/storage-service";
import { scanDocuments } from "@/lib/scan";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirm, confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { TripDocument, TripDocumentKind } from "@/types";

/** Rows shown in a band before "See all" hands off to the sheet. */
const PREVIEW_COUNT = 4;

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const heroHeight = insets.top + 300;
  // Floating hero controls become a solid titled bar once the hero scrolls away.
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [gemsOpen, setGemsOpen] = useState(false);
  /** Scanned pages waiting for the user to pick their document kind. */
  const [pendingScans, setPendingScans] = useState<LocalMedia[]>([]);
  const [kindSheetOpen, setKindSheetOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TripDocument | null>(null);

  const { data: trip, isLoading } = useFirestoreLiveQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip(tripId!),
    subscribe: (onData, onError) => subscribeTrip(tripId!, onData, onError),
    enabled: !!tripId,
  });

  const { data: expenses = [] } = useFirestoreLiveQuery({
    queryKey: ["trip-expenses", tripId, user?.uid],
    queryFn: () => fetchTripExpenses(tripId!, user!.uid),
    subscribe: (onData, onError) =>
      subscribeTripExpenses(tripId!, user!.uid, onData, onError),
    enabled: !!tripId && !!user,
  });

  const { data: tripGems = [] } = useFirestoreLiveQuery({
    queryKey: ["trip-gems", tripId, user?.uid],
    queryFn: () => fetchTripGems(tripId!, user!.uid),
    subscribe: (onData, onError) =>
      subscribeTripGems(tripId!, user!.uid, onData, onError),
    enabled: !!tripId && !!user,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const gemMap = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);
  const soldTripGems = useMemo(
    () =>
      tripGems
        .filter((tg) => tg.status === "sold")
        .slice()
        .sort((a, b) => {
          const aMs = a.saleDate?.toMillis?.() ?? 0;
          const bMs = b.saleDate?.toMillis?.() ?? 0;
          return bMs - aMs;
        }),
    [tripGems],
  );
  const activeTripGems = useMemo(
    () => tripGems.filter((tg) => tg.status !== "sold"),
    [tripGems],
  );
  const summary = useMemo(
    () => (trip ? computeTripSummary(expenses, tripGems, gems) : null),
    [trip, expenses, tripGems, gems],
  );
  // Travel documents are owner-only: never surface them to anyone else.
  const isOwner = !!user && !!trip && trip.ownerUid === user.uid;
  const travelDocuments = useMemo(
    () =>
      isOwner
        ? (trip?.documents ?? [])
            .slice()
            .sort(
              (a, b) =>
                (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0),
            )
        : [],
    [isOwner, trip?.documents],
  );

  const typeMeta = TRIP_TYPES.find((t) => t.id === trip?.tripType);
  const isSourcing = trip?.tripType === "sourcing" || trip?.tripType === "both";
  const isSelling = trip?.tripType === "selling" || trip?.tripType === "both";
  const canRecordSales = isSelling && trip?.status === "ongoing";
  const sheets = {
    addExpense: `/(marketplace)/trips/${tripId}/add-expense`,
    addGem: `/(marketplace)/gems/add?tripId=${tripId}`,
    addGems: `/(marketplace)/trips/${tripId}/add-gems`,
  };

  const [updatingStatus, handleStatus] = usePendingAction(async (
    next: "ongoing" | "completed" | "cancelled",
  ) => {
    if (!trip) return;
    try {
      await updateTripStatus(trip.id, next);
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success(
        `Trip marked as ${TRIP_STATUS_LABELS[next].toLowerCase()}.`,
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not update trip."));
    }
  });

  async function handleSaveBudget(next: {
    budget: number;
    budgetCurrency: string;
  }) {
    if (!user || !trip) return;
    try {
      await updateTripBudget(trip.id, user.uid, next);
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Budget updated.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update budget."));
      throw e;
    }
  }

  async function handleDistributeOverhead() {
    if (!user || !trip) return;
    await confirm({
      title: "Distribute overhead",
      message:
        "Split trip expenses across gems purchased on this trip by purchase cost?",
      confirmLabel: "Distribute",
      cancelLabel: "Cancel",
      icon: "pie-chart",
      onConfirm: async () => {
        try {
          const amount = await distributeTripOverhead(user.uid, trip.id);
          await queryClient.invalidateQueries({ queryKey: ["gems"] });
          toast.success(`Distributed ${formatBase(amount)} across gems.`);
        } catch (e) {
          toast.error(friendlyError(e, "Could not distribute overhead."));
          throw e;
        }
      },
    });
  }

  const [scanning, handleScanDocuments] = usePendingAction(async () => {
    try {
      const pages = await scanDocuments({ maxPages: 4 });
      if (!pages.length) return;
      setPendingScans(pages);
      setKindSheetOpen(true);
    } catch (e) {
      toast.error(friendlyError(e, "Could not scan document."));
    }
  });

  const [uploadingDocs, uploadScans] = usePendingAction(async (
    kind: TripDocumentKind,
    pages: LocalMedia[],
  ) => {
    if (!user || !trip) return;
    try {
      await addTripDocuments(
        trip.id,
        user.uid,
        pages.map((media) => ({ kind, media })),
      );
      toast.success(
        pages.length > 1
          ? `${pages.length} pages added to travel documents.`
          : `${tripDocumentKindLabel(kind)} added to travel documents.`,
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not upload documents."));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    }
  });

  function handlePickDocumentKind(kind: TripDocumentKind) {
    const pages = pendingScans;
    setKindSheetOpen(false);
    setPendingScans([]);
    if (pages.length) void uploadScans(kind, pages);
  }

  function handleRemoveDocument(document: TripDocument) {
    if (!user || !trip) return;
    const label = tripDocumentKindLabel(document.kind);
    void confirmDelete(
      `Delete ${label.toLowerCase()}?`,
      `The scanned ${label.toLowerCase()} will be removed from this trip.`,
      async () => {
        try {
          await removeTripDocument(trip.id, user.uid, document.id);
          await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
          toast.success(`${label} deleted.`);
        } catch (e) {
          toast.error(friendlyError(e, "Could not delete document."));
          throw e;
        }
      },
    );
  }

  function handleRequestSale(tripGem: { id: string; gemId: string }) {
    if (!trip) return;
    setGemsOpen(false);
    router.push(
      `/(marketplace)/(tabs)/workspace/gems/${encodeURIComponent(tripGem.gemId)}?sell=1&tripId=${encodeURIComponent(trip.id)}&tripGemId=${encodeURIComponent(tripGem.id)}` as never,
    );
  }

  function openGem(gemId: string) {
    router.push(`/(marketplace)/(tabs)/workspace/gems/${gemId}` as never);
  }

  if (isLoading || !trip || !summary) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="Trip" />
        <View style={styles.center}>
          <Text style={[styles.loading, { color: colors.textMuted }]}>
            Loading…
          </Text>
        </View>
      </View>
    );
  }

  const budgetBase = tripBudgetBase(trip);
  const hasBudget = budgetBase > 0;
  const spent = tripBudgetSpent(summary.totalExpenses, summary.purchaseSpend);
  const remaining = budgetRemaining(trip, spent);
  const budgetPct = budgetUsedPercent(trip, spent);
  const overBudget = hasBudget && remaining < 0;
  const budgetLabel = hasBudget
    ? formatStored({
        amount: trip.budget,
        currency: trip.budgetCurrency,
        amountBase: budgetBase,
      })
    : null;
  const statusAccent = TRIP_STATUS_ACCENT[trip.status];
  const showStart = canStartTrip(trip.status);
  const showComplete = canCompleteTrip(trip.status);
  const hasBottomActions = showStart || showComplete;
  const bottomBarPad = Math.max(insets.bottom, 12);
  const previewGems = activeTripGems.slice(0, PREVIEW_COUNT);
  const previewExpenses = expenses.slice(0, PREVIEW_COUNT);
  const showOverhead =
    isSourcing && summary.totalGemsPurchased > 0 && summary.totalExpenses > 0;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={headerSolid ? "auto" : "light"} />
      <ThemedScrollView
        contentContainerStyle={{
          paddingBottom: hasBottomActions ? 96 + bottomBarPad : 48,
        }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <TripFlagHero
          country={trip.destinationCountry}
          city={trip.destinationCity}
          height={heroHeight}
        />

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip
                label={TRIP_STATUS_LABELS[trip.status]}
                accent={statusAccent}
              />
              {typeMeta ? (
                <StatusChip
                  label={typeMeta.label}
                  accent={colors.onSurfaceVariant}
                />
              ) : null}
            </>
          }
          title={trip.tripName}
        >
          <TripRouteStrip
            status={trip.status}
            start={toTripDate(trip.startDate)}
            end={toTripDate(trip.actualEndDate ?? trip.expectedEndDate)}
            days={tripDurationDays(trip)}
          />
          <KeyStats
            items={
              hasBudget
                ? [
                    {
                      label: "Budget",
                      value: budgetLabel ?? "",
                      sub: `${budgetPct}% used`,
                    },
                    { label: "Spent", value: formatBase(spent) },
                    {
                      label: overBudget ? "Over by" : "Remaining",
                      value: formatBase(Math.abs(remaining)),
                      color: overBudget ? Accent.rose : undefined,
                    },
                  ]
                : [
                    {
                      label: "Budget",
                      value: "Not set",
                      color: colors.textMuted,
                    },
                    { label: "Spent", value: formatBase(spent) },
                    {
                      label: "Gems",
                      value: String(tripGems.length),
                      sub: soldTripGems.length
                        ? `${soldTripGems.length} sold`
                        : activeTripGems.length
                          ? `${activeTripGems.length} on trip`
                          : null,
                    },
                  ]
            }
          />
        </TitleBand>

        <TripBudgetBand
          budgetLabel={budgetLabel}
          spentLabel={formatBase(spent)}
          expensesLabel={formatBase(summary.totalExpenses)}
          purchasesLabel={
            isSourcing || summary.purchaseSpend > 0
              ? formatBase(summary.purchaseSpend)
              : null
          }
          remainingNegative={overBudget}
          percent={budgetPct}
          budgetAmount={trip.budget}
          budgetCurrency={trip.budgetCurrency}
          onSaveBudget={handleSaveBudget}
        />

        <DetailBand
          title="Gems on trip"
          trailing={
            <BandLink
              label={
                activeTripGems.length > PREVIEW_COUNT
                  ? `See all ${activeTripGems.length}`
                  : "Manage"
              }
              onPress={() => setGemsOpen(true)}
            />
          }
        >
          {previewGems.length ? (
            <View>
              {previewGems.map((tg, i) => {
                const gem = gemMap.get(tg.gemId);
                return (
                  <TripGemRow
                    key={tg.id}
                    tripGem={tg}
                    gem={gem}
                    isLast={i === previewGems.length - 1}
                    onPress={() => openGem(tg.gemId)}
                    onSell={
                      canSellTripGem(tg, gem, canRecordSales)
                        ? () => handleRequestSale(tg)
                        : null
                    }
                  />
                );
              })}
            </View>
          ) : (
            <>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                {isSourcing && isSelling
                  ? "Record purchases or add gems to a parcel to track deals here."
                  : isSelling
                    ? "Add gems to the parcel you're taking on this trip."
                    : "Record gems you buy on this trip."}
              </Text>
              <View style={styles.inlineActions}>
                {isSourcing ? (
                  <Button
                    title="Add gem"
                    icon="diamond"
                    variant={isSelling ? "secondary" : "primary"}
                    onPress={() => router.push(sheets.addGem as never)}
                    style={isSelling ? styles.inlineHalf : undefined}
                  />
                ) : null}
                {isSelling ? (
                  <Button
                    title="Add gems"
                    icon="inventory-2"
                    onPress={() => router.push(sheets.addGems as never)}
                    style={isSourcing ? styles.inlineHalf : undefined}
                  />
                ) : null}
              </View>
            </>
          )}
        </DetailBand>

        <DetailBand
          title="Expenses"
          trailing={
            <BandLink
              label={
                expenses.length > PREVIEW_COUNT
                  ? `See all ${expenses.length}`
                  : "Add expense"
              }
              onPress={() =>
                expenses.length > PREVIEW_COUNT
                  ? setExpensesOpen(true)
                  : router.push(sheets.addExpense as never)
              }
            />
          }
        >
          {previewExpenses.length ? (
            <View>
              <DetailRows
                rows={previewExpenses.map((e) => tripExpenseRow(e, formatStored))}
              />
              <TotalRow
                label="Total expenses"
                value={formatBase(summary.totalExpenses)}
              />
            </View>
          ) : (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Log flights, stays, and other trip costs.
            </Text>
          )}
        </DetailBand>

        {isOwner ? (
          <DetailBand
            title="Travel documents"
            trailing={
              <TripDocumentsScanLink
                busy={uploadingDocs}
                onPress={() => {
                  if (scanning || uploadingDocs || kindSheetOpen) return;
                  void handleScanDocuments();
                }}
              />
            }
          >
            {travelDocuments.length ? (
              <DetailRows
                rows={travelDocuments.map((d) => {
                  const label = tripDocumentKindLabel(d.kind);
                  return {
                    key: d.id,
                    leading: <TripDocumentThumb uri={d.url} />,
                    label,
                    hint: d.addedAt ? `Added ${formatDate(d.addedAt)}` : null,
                    value: (
                      <Pressable
                        onPress={() => handleRemoveDocument(d)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${label}`}
                        style={({ pressed }) => [
                          styles.docDelete,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Icon
                          name="delete-outline"
                          size={20}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    ),
                    onPress: () => setViewingDoc(d),
                  };
                })}
              />
            ) : (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                Scan your passport, visa, or tickets to keep them with this trip.
                Only you can see them.
              </Text>
            )}
          </DetailBand>
        ) : null}

        <TripSoldGemsSection
          soldGems={soldTripGems}
          gemMap={gemMap}
          onOpenGem={openGem}
        />

        {showOverhead ? (
          <DetailBand title="Overhead">
            <DetailRow
              icon="pie-chart"
              label="Distribute overhead to gems"
              hint={`Split ${formatBase(summary.totalExpenses)} of expenses across ${summary.totalGemsPurchased} purchased gem${summary.totalGemsPurchased === 1 ? "" : "s"} by cost`}
              value={null}
              onPress={() => void handleDistributeOverhead()}
              isLast
            />
          </DetailBand>
        ) : null}

        {trip.notes ? (
          <DetailBand title="Notes">
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {trip.notes}
            </Text>
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader title={trip.tripName} solid={headerSolid} />

      {hasBottomActions ? (
        <View
          style={[
            detailStyles.actionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.outlineVariant,
              paddingBottom: bottomBarPad,
            },
          ]}
        >
          {showStart ? (
            <Button
              title="Start trip"
              icon="flight"
              loading={updatingStatus}
              onPress={() => handleStatus("ongoing")}
              style={styles.actionBarBtn}
            />
          ) : null}
          {showComplete ? (
            <Button
              title="Complete trip"
              icon="done-all"
              loading={updatingStatus}
              onPress={() => {
                void confirm({
                  title: "Complete trip?",
                  message: `Mark “${trip.tripName}” as completed? Expenses, gems, and sales stay available to review.`,
                  confirmLabel: "Complete",
                  cancelLabel: "Cancel",
                  icon: "done-all",
                  onConfirm: () => handleStatus("completed"),
                });
              }}
              style={styles.actionBarBtn}
            />
          ) : null}
        </View>
      ) : null}

      <TripExpensesSheet
        visible={expensesOpen}
        onClose={() => setExpensesOpen(false)}
        expenses={expenses}
        onAddExpense={() => router.push(sheets.addExpense as never)}
      />
      <TripGemsSheet
        visible={gemsOpen}
        onClose={() => setGemsOpen(false)}
        tripGems={activeTripGems}
        gemMap={gemMap}
        canRecordSales={canRecordSales}
        onOpenGem={openGem}
        onRequestSale={handleRequestSale}
        showAddGem={isSourcing}
        showAddGems={isSelling}
        onAddGem={() => router.push(sheets.addGem as never)}
        onAddGems={() => router.push(sheets.addGems as never)}
      />
      {isOwner ? (
        <>
          <TripDocumentKindSheet
            visible={kindSheetOpen}
            pageCount={pendingScans.length}
            onClose={() => {
              setKindSheetOpen(false);
              setPendingScans([]);
            }}
            onSelect={handlePickDocumentKind}
          />
          <TripDocumentViewer
            uri={viewingDoc?.url ?? null}
            title={viewingDoc ? tripDocumentKindLabel(viewingDoc.kind) : undefined}
            onClose={() => setViewingDoc(null)}
          />
        </>
      ) : null}
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { ...text, fontFamily: FontFamily.regular, fontSize: 14 },
  emptyHint: { ...text, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  inlineActions: { flexDirection: "row", gap: Spacing.sm },
  inlineHalf: { flex: 1 },
  docDelete: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  notes: { ...text, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
  actionBarBtn: { flex: 1 },
});
