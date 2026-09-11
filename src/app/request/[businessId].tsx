import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { StackHeader } from "@/components/ui/stack-header";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { GemPickerSheet } from "@/components/workspace/gem-picker-sheet";
import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
  LAPIDARY_SERVICE_OPTIONS,
  isVerifiedRole,
  normalizeLapidaryServiceId,
  type LapidaryServiceId,
} from "@/constants/roles";
import {
  fetchBusiness,
  fetchBusinessByOwnerUid,
} from "@/features/marketplace/marketplace-service";
import {
  subscribeBusiness,
  subscribeBusinessByOwnerUid,
  subscribeGems,
} from "@/features/workspace/firestore-subscriptions";
import {
  createServiceRequest,
} from "@/features/marketplace/request-service";
import { fetchGems } from "@/features/workspace/workspace-service";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";
import type { WorkspaceGem } from "@/types";

const SERVICE_ICONS: Record<LapidaryServiceId, IconName> = {
  cutting: "content-cut",
  heating: "local-fire-department",
  polishing: "auto-fix-high",
};

const SERVICE_HINTS: Record<LapidaryServiceId, string> = {
  cutting: "Facet or re-cut the stone",
  heating: "Controlled heat treatment",
  polishing: "Finish and bring out luster",
};

function gemDisplayName(gem: WorkspaceGem): string {
  return (
    gem.title?.trim() ||
    gem.variety?.trim() ||
    formatGemType(gem.gemType) ||
    gem.sku ||
    "Gem"
  );
}

function serviceLabel(id: LapidaryServiceId): string {
  return LAPIDARY_SERVICE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

type RequestStep = "services" | "gem" | "preview";
const SHEET_TRANSITION_DELAY = Motion.normal + 40;

export default function RequestServiceScreen() {
  const {
    businessId,
    gemId: gemIdParam,
  } = useLocalSearchParams<{
    businessId: string;
    gemId?: string;
  }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();

  const [step, setStep] = useState<RequestStep | null>(null);
  const [notes, setNotes] = useState("");
  const [serviceTypes, setServiceTypes] = useState<LapidaryServiceId[]>([]);
  const [gemId, setGemId] = useState(gemIdParam ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const didAutoOpen = useRef(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStepRef = useRef<RequestStep | null>(null);

  const { data: business } = useFirestoreLiveQuery({
    queryKey: ["business", businessId],
    queryFn: () => fetchBusiness(businessId!),
    subscribe: (onData, onError) =>
      subscribeBusiness(businessId!, onData, onError),
    enabled: !!businessId,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user && isVerifiedRole(profile, "trader"),
  });

  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user,
  });

  const selectedGem = useMemo(
    () => gems.find((g) => g.id === gemId) ?? null,
    [gems, gemId],
  );

  const serviceOptions = useMemo(() => {
    const configuredServices = business?.providerProfile?.services;
    const activeConfiguredValues = (configuredServices ?? [])
      .filter((service) => service.isActive !== false)
      .map((service) => service.serviceId || service.name)
      .map(normalizeLapidaryServiceId)
      .filter((value): value is LapidaryServiceId => value !== null);
    const configuredValues =
      activeConfiguredValues.length > 0
        ? activeConfiguredValues
        : business?.providerProfile?.servicesOffered ?? [];
    const offered = new Set(
      configuredValues
        .map(normalizeLapidaryServiceId)
        .filter((value): value is LapidaryServiceId => value !== null),
    );
    return LAPIDARY_SERVICE_OPTIONS.filter((option) => offered.has(option.id));
  }, [business?.providerProfile?.services, business?.providerProfile?.servicesOffered]);
  const selectedServiceTypeSet = new Set(serviceTypes);

  useEffect(() => {
    setServiceTypes((previous) =>
      previous.filter((id) => serviceOptions.some((option) => option.id === id)),
    );
  }, [serviceOptions]);

  useEffect(() => {
    if (
      user &&
      business &&
      isVerifiedRole(profile, "trader") &&
      !didAutoOpen.current
    ) {
      didAutoOpen.current = true;
      setStep("services");
    }
  }, [business, profile, user]);

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    [],
  );

  if (!user) return <Redirect href="/(auth)/login" />;

  if (!isVerifiedRole(profile, "trader")) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
      >
        <StackHeader title="Request service" />
        <View style={{ padding: Spacing.lg }}>
          <Text style={{ color: colors.textMuted }}>
            Only verified traders can send requests.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleService(serviceId: LapidaryServiceId) {
    setServiceTypes((prev) =>
      prev.includes(serviceId)
        ? prev.filter((x) => x !== serviceId)
        : [...prev, serviceId],
    );
    clearField("serviceTypes");
  }

  function selectGem(gem: WorkspaceGem) {
    setGemId(gem.id);
    clearField("gemId");
    pendingStepRef.current = "preview";
    setStep(null);
    queueStep("preview");
  }

  function handleSheetClose() {
    const next = pendingStepRef.current;
    pendingStepRef.current = null;
    setStep(null);
    if (next) {
      queueStep(next);
      return;
    }
    router.back();
  }

  function transitionAfterClose(next: RequestStep) {
    pendingStepRef.current = next;
    setStep(null);
    queueStep(next);
  }

  function queueStep(next: RequestStep) {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      pendingStepRef.current = null;
      setStep(next);
    }, SHEET_TRANSITION_DELAY);
  }

  function continueServices() {
    if (serviceTypes.length === 0) {
      setErrors({ serviceTypes: "Select at least one service" });
      toast.error("Select at least one service");
      return;
    }
    clearField("serviceTypes");
    transitionAfterClose("gem");
  }

  async function submit() {
    if (!user || !business) return;
    const nextErrors: Record<string, string> = {};
    const gem = gems.find((g) => g.id === gemId);
    if (!gem) nextErrors.gemId = "Select a gem from your inventory";
    if (serviceTypes.length === 0)
      nextErrors.serviceTypes = "Select at least one service";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]!);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await withLoading(async () => {
        const gemName = gemDisplayName(gem!);
        await createServiceRequest({
          traderUid: user.uid,
          traderBusinessId: myBusiness?.id ?? null,
          traderBusinessName: myBusiness?.businessName ?? profile?.displayName ?? null,
          traderBusinessLogoUrl: myBusiness?.logoUrl ?? null,
          lapidaryBusinessId: business.id,
          providerName: business.businessName,
          providerBusinessName: business.businessName,
          providerBusinessLogoUrl: business.logoUrl,
          gemId: gem!.id,
          gemName,
          gemPhotoUrl: gemPrimaryPhotoUrl(gem),
          serviceTypes,
          notes,
          expectedReturnDays: 14,
          weightBefore: gem!.currentWeight,
        });
        toast.success("Service request sent.");
        router.back();
      }, "Sending request…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not send request."));
    } finally {
      setSubmitting(false);
    }
  }

  const placeLine = [business?.city, business?.district]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top"]}
    >
      <BottomSheet
        visible={step === "services"}
        onClose={handleSheetClose}
        title="Choose services"
        footer={
          <Button
            title={serviceOptions.length ? "Continue" : "No services available"}
            onPress={continueServices}
            disabled={serviceTypes.length === 0 || serviceOptions.length === 0}
          />
        }
      >
        <Text style={[styles.sheetIntro, { color: colors.textMuted }]}>
          Select the services this workshop has published. You can choose more than one.
        </Text>
        {serviceOptions.length > 0 ? (
          <View style={styles.serviceList}>
            {serviceOptions.map((s) => {
              const active = selectedServiceTypeSet.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={s.label}
                  onPress={() => toggleService(s.id)}
                  style={({ pressed }) => [
                    styles.serviceRow,
                    {
                      backgroundColor: active
                        ? colors.primaryContainer
                        : colors.surfaceContainerLowest,
                      borderColor: active
                        ? colors.primary
                        : errors.serviceTypes
                          ? colors.error
                          : colors.outlineVariant,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.serviceIcon,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Icon
                      name={SERVICE_ICONS[s.id]}
                      size={18}
                      color={active ? colors.onPrimary : colors.onSurfaceVariant}
                    />
                  </View>
                  <View style={styles.serviceBody}>
                    <Text style={[styles.serviceLabel, { color: colors.onSurface }]}>
                      {s.label}
                    </Text>
                    <Text
                      style={[styles.serviceHint, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {SERVICE_HINTS[s.id]}
                    </Text>
                  </View>
                  <Icon
                    name={active ? "check-circle" : "radio-button-unchecked"}
                    size={22}
                    color={active ? colors.primary : colors.outline}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyServices}>
            <Icon name="handyman" size={30} color={colors.outlineVariant} />
            <Text style={[styles.emptyServicesTitle, { color: colors.onSurface }]}>
              No services published
            </Text>
            <Text style={[styles.emptyServicesHint, { color: colors.textMuted }]}>
              This lapidary has not selected Cut, Heat, or Polish in their profile yet.
            </Text>
          </View>
        )}
        {errors.serviceTypes ? (
          <Text style={[styles.fieldError, { color: colors.error }]}>
            {errors.serviceTypes}
          </Text>
        ) : null}
      </BottomSheet>

      <GemPickerSheet
        visible={step === "gem"}
        onClose={handleSheetClose}
        gems={gems}
        value={gemId}
        title="Select gem"
        emptyHint="Add a gem in Workspace first."
        onSelect={selectGem}
      />

      <BottomSheet
        visible={step === "preview"}
        onClose={handleSheetClose}
        title="Review request"
        footer={
          <Button
            title="Send request"
            icon="send"
            onPress={submit}
            loading={submitting}
            disabled={!selectedGem || serviceTypes.length === 0}
          />
        }
      >
        <View style={styles.previewBlock}>
          <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Workshop</Text>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Icon name="handyman" size={22} color={colors.primary} />
            <View style={styles.previewBody}>
              <Text style={[styles.workshopName, { color: colors.onSurface }]}>
                {business?.businessName ?? "Lapidary"}
              </Text>
              {placeLine ? (
                <Text style={[styles.workshopMeta, { color: colors.textMuted }]}>
                  {placeLine}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.previewBlock}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Services</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change services"
              onPress={() => transitionAfterClose("services")}
            >
              <Text style={[styles.stepAction, { color: colors.primary }]}>Change</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {serviceTypes.map((id) => (
              <View
                key={id}
                style={[styles.summaryChip, { backgroundColor: colors.primaryContainer }]}
              >
                <Icon name={SERVICE_ICONS[id]} size={16} color={colors.primary} />
                <Text style={[styles.summaryChipText, { color: colors.onPrimaryContainer }]}>
                  {serviceLabel(id)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.previewBlock}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Gem</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change gem"
              onPress={() => transitionAfterClose("gem")}
            >
              <Text style={[styles.stepAction, { color: colors.primary }]}>Change</Text>
            </Pressable>
          </View>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <GemThumb
              uri={gemPrimaryPhotoUrl(selectedGem)}
              label={selectedGem ? gemDisplayName(selectedGem) : "Gem"}
              size={56}
              radius={14}
            />
            <View style={styles.previewBody}>
              <Text style={[styles.workshopName, { color: colors.onSurface }]}>
                {selectedGem ? gemDisplayName(selectedGem) : "Select a gem"}
              </Text>
              {selectedGem ? (
                <Text style={[styles.workshopMeta, { color: colors.textMuted }]}>
                  {formatGemType(selectedGem.gemType)} · {selectedGem.currentWeight} ct
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Input
          label="Notes for the workshop"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional instructions, timing, preferences…"
          leftIcon="notes"
          multiline
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  workshopName: { ...Typography.bodyLg, fontWeight: "700" },
  workshopMeta: { ...Typography.caption },
  stepAction: { ...Typography.labelMd, fontWeight: "700" },
  sheetIntro: { ...Typography.bodyMd, lineHeight: 20 },
  serviceList: { gap: Spacing.sm },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabel: { ...Typography.bodyMd, fontWeight: "600" },
  serviceHint: { ...Typography.caption },
  serviceBody: { flex: 1, minWidth: 0, gap: 2 },
  fieldError: { ...Typography.caption, marginTop: Spacing.xs },
  emptyServices: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  emptyServicesTitle: { ...Typography.bodyMd, fontWeight: "700" },
  emptyServicesHint: { ...Typography.bodySmall, textAlign: "center" },
  previewBlock: { gap: Spacing.sm },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewLabel: {
    ...Typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  previewBody: { flex: 1, minWidth: 0, gap: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  summaryChipText: { ...Typography.labelMd, fontWeight: "700" },
});
