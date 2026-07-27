import { useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  GemPickerSheet,
  GemSelectField,
} from "@/components/workspace/gem-picker-sheet";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
  LAPIDARY_SERVICE_OPTIONS,
  isVerifiedRole,
  type LapidaryServiceId,
} from "@/constants/roles";
import {
  fetchBusiness,
  fetchBusinessByOwnerUid,
} from "@/features/marketplace/marketplace-service";
import {
  createClientNotification,
  createServiceRequest,
} from "@/features/marketplace/request-service";
import { fetchGems } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { WorkspaceGem } from "@/types";

const SERVICE_ICONS: Record<LapidaryServiceId, IconName> = {
  cutting: "content-cut",
  polishing: "auto-fix-high",
  shaping: "category",
  heating: "local-fire-department",
  chemical_treatment: "science",
  other: "more-horiz",
};

const SERVICE_HINTS: Record<LapidaryServiceId, string> = {
  cutting: "Facet or re-cut the stone",
  polishing: "Finish and bring out luster",
  shaping: "Shape or preform the rough",
  heating: "Controlled heat treatment",
  chemical_treatment: "Chemical enhancement",
  other: "Describe in notes",
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

export default function RequestServiceScreen() {
  const {
    businessId,
    gemId: gemIdParam,
    mode,
  } = useLocalSearchParams<{
    businessId: string;
    gemId?: string;
    mode?: "service" | "cert";
  }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();

  const [notes, setNotes] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [gemId, setGemId] = useState(gemIdParam ?? "");
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => fetchBusiness(businessId!),
    enabled: !!businessId,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user && isVerifiedRole(profile, "trader"),
  });

  const { data: myBusiness } = useQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  const selectedGem = useMemo(
    () => gems.find((g) => g.id === gemId) ?? null,
    [gems, gemId],
  );

  const serviceOptions = useMemo(() => {
    const offered = business?.providerProfile?.servicesOffered ?? [];
    if (!offered.length) return [...LAPIDARY_SERVICE_OPTIONS];
    const filtered = LAPIDARY_SERVICE_OPTIONS.filter((s) =>
      offered.includes(s.id),
    );
    return filtered.length ? filtered : [...LAPIDARY_SERVICE_OPTIONS];
  }, [business?.providerProfile?.servicesOffered]);

  if (!user) return <Redirect href="/(auth)/login" />;

  // Certification is verified on GemFort against lab uploads — not requested from labs.
  if (mode === "cert") {
    return <Redirect href="/verify-certificate" />;
  }

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

  function toggleService(id: string) {
    setServiceTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    clearField("serviceTypes");
  }

  function selectGem(gem: WorkspaceGem) {
    setGemId(gem.id);
    clearField("gemId");
    setGemSheetOpen(false);
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
    try {
      await withLoading(async () => {
        const gemName = gemDisplayName(gem!);
        const id = await createServiceRequest({
          traderUid: user.uid,
          traderBusinessId: myBusiness?.id ?? null,
          lapidaryUid: business.ownerUid,
          lapidaryBusinessId: business.id,
          gemId: gem!.id,
          gemName,
          serviceTypes,
          notes,
        });
        await createClientNotification({
          recipientUid: business.ownerUid,
          type: "service_request_received",
          title: "New service request",
          message: `${profile?.displayName ?? "A trader"} requested ${serviceTypes.join(", ")} for ${gemName}.`,
          referenceType: "service_request",
          referenceId: id,
        });
        toast.success("Service request sent.");
        router.back();
      }, "Sending request…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not send request."));
    }
  }

  const placeLine = [business?.city, business?.district]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Request service" />
      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection title="Workshop">
          <View
            style={[
              styles.workshopCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View
              style={[
                styles.workshopIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon
                name="handyman"
                size={22}
                color={colors.onPrimaryContainer}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[styles.workshopName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {business?.businessName ?? "Lapidary"}
              </Text>
              {placeLine ? (
                <Text
                  style={[styles.workshopMeta, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {placeLine}
                </Text>
              ) : null}
            </View>
          </View>
        </FormSection>

        <FormSection title="Gem" hint="Choose the stone to send for work">
          <GemSelectField
            label="Your gem"
            gem={selectedGem}
            placeholder="Select from inventory"
            onPress={() => setGemSheetOpen(true)}
            error={errors.gemId}
          />
        </FormSection>

        <FormSection
          title="Services"
          hint="Select one or more services for this job"
        >
          <View style={styles.serviceList}>
            {serviceOptions.map((s) => {
              const active = serviceTypes.includes(s.id);
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
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        styles.serviceLabel,
                        { color: colors.onSurface },
                      ]}
                    >
                      {s.label}
                    </Text>
                    <Text
                      style={[
                        styles.serviceHint,
                        { color: colors.textMuted },
                      ]}
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
          {errors.serviceTypes ? (
            <Text style={[styles.fieldError, { color: colors.error }]}>
              {errors.serviceTypes}
            </Text>
          ) : null}
        </FormSection>

        <FormSection title="Notes">
          <Input
            label="Notes for the workshop"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional instructions, timing, preferences…"
            leftIcon="notes"
            multiline
          />
        </FormSection>
      </ThemedScrollView>

      <FormFooter
        title="Send request"
        onPress={submit}
        icon="send"
      />

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={gems}
        value={gemId}
        title="Select gem"
        emptyHint="Add a gem in Workspace first."
        onSelect={selectGem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.xxl, gap: Spacing.md },
  workshopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  workshopIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  workshopName: { ...Typography.bodyLg, fontWeight: "700" },
  workshopMeta: { ...Typography.caption },
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
  fieldError: { ...Typography.caption, marginTop: Spacing.xs },
});
