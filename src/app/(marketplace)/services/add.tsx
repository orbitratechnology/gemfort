import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
    PickerSelectField,
    ProviderPickerSheet,
    type ProviderSelection,
} from "@/components/workspace/contact-picker-sheet";
import {
    GemPickerSheet,
    GemSelectField,
} from "@/components/workspace/gem-picker-sheet";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { fetchBusiness } from "@/features/marketplace/marketplace-service";
import {
    subscribeContacts,
    subscribeGems,
} from "@/features/workspace/firestore-subscriptions";
import {
    createService,
    fetchContacts,
    fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import { Timestamp } from "@/lib/firebase/db";
import { addServiceSchema, parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";

const SERVICE_TYPES = [
  { id: "cutting", label: "Cutting" },
  { id: "heating", label: "Heating" },
  { id: "polishing", label: "Polishing" },
  { id: "recutting", label: "Recutting" },
  { id: "appraisal", label: "Appraisal" },
];

export default function AddServiceScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const { gemId: preselectedGemId } = useLocalSearchParams<{
    gemId?: string;
  }>();

  const [gemId, setGemId] = useState(preselectedGemId ?? "");
  const [provider, setProvider] = useState<ProviderSelection | null>(null);
  const [serviceType, setServiceType] = useState("cutting");
  const [weightBefore, setWeightBefore] = useState("");
  const [daysUntilReturn, setDaysUntilReturn] = useState("14");
  const [gemSheetOpen, setGemSheetOpen] = useState(false);
  const [providerSheetOpen, setProviderSheetOpen] = useState(false);
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
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const selectedGem = useMemo(
    () => gems.find((g) => g.id === gemId) ?? null,
    [gems, gemId],
  );

  const weightBeforeValue =
    weightBefore || (selectedGem ? String(selectedGem.currentWeight) : "");

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addServiceSchema, {
      gemId,
      hasProvider: provider ? true : false,
      weightBefore: weightBeforeValue,
      daysUntilReturn,
      serviceType,
    });
    if (!result.success) {
      const mapped = { ...result.errors };
      if (mapped.hasProvider) {
        mapped.provider = mapped.hasProvider;
        delete mapped.hasProvider;
      }
      setErrors(mapped);
      toast.error(Object.values(mapped)[0]!);
      return;
    }
    if (!provider) return;
    setErrors({});

    try {
      await withLoading(async () => {
        let providerUid: string | null = null;
        if (provider.source === "business") {
          const biz = await fetchBusiness(provider.businessId);
          providerUid = biz?.ownerUid ?? null;
        }
        const expectedReturn = Timestamp.fromDate(
          new Date(Date.now() + result.data.daysUntilReturn * 86400000),
        );
        const id = await createService(user.uid, {
          gemId: result.data.gemId,
          serviceType: result.data.serviceType,
          providerContactId:
            provider.source === "contact" ? provider.contactId : "",
          providerBusinessId:
            provider.source === "business" ? provider.businessId : null,
          providerUid,
          providerName: provider.label,
          dateGiven: Timestamp.now(),
          expectedReturnDate: expectedReturn,
          weightBefore: result.data.weightBefore,
          photoBeforeUrls: [],
          instructions: null,
          agreedPrice: null,
          agreedPriceCurrency: null,
          advancePaid: 0,
        });
        toast.success("Service record created");
        replaceWithAnchor(`/(marketplace)/(tabs)/workspace/services/${id}`);
      }, "Adding service…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not create service."));
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add Service" closeIcon />
      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenInset>
          <GemSelectField
            label="Gem"
            gem={selectedGem}
            onPress={() => setGemSheetOpen(true)}
            error={errors.gemId}
          />
        </ScreenInset>

        <FormSection title="Service type" padded={false}>
          <View style={styles.chips}>
            {SERVICE_TYPES.map((t) => {
              const active = serviceType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setServiceType(t.id)}
                  style={[
                    styles.chip,
                    active
                      ? {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        }
                      : {
                          backgroundColor: colors.surfaceContainerLowest,
                          borderColor: colors.outlineVariant,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? colors.onPrimary
                          : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Details">
          <MaskedInput
            label="Weight Before (ct)"
            mode="weight"
            value={weightBeforeValue}
            onChangeText={(v) => {
              setWeightBefore(v);
              setErrors((e) => {
                if (!e.weightBefore) return e;
                const next = { ...e };
                delete next.weightBefore;
                return next;
              });
            }}
            leftIcon="scale"
            error={errors.weightBefore}
          />
          <MaskedInput
            label="Days Until Return"
            mode="custom"
            mask="999"
            value={daysUntilReturn}
            onChangeText={(v) => {
              setDaysUntilReturn(v);
              setErrors((e) => {
                if (!e.daysUntilReturn) return e;
                const next = { ...e };
                delete next.daysUntilReturn;
                return next;
              });
            }}
            keyboardType="number-pad"
            leftIcon="schedule"
            error={errors.daysUntilReturn}
          />
        </FormSection>

        <ScreenInset style={styles.footer}>
          <PickerSelectField
            label="Provider"
            valueLabel={provider?.label ?? null}
            subtitle={
              provider?.source === "business"
                ? provider.businessType.replace(/_/g, " ")
                : provider?.source === "contact"
                  ? "Saved contact"
                  : null
            }
            placeholder="Search lapidaries or contacts…"
            icon="handyman"
            onPress={() => setProviderSheetOpen(true)}
            error={errors.provider}
          />

          <Button title="Add Service" icon="handyman" onPress={handleSubmit} />
        </ScreenInset>
      </ThemedScrollView>

      <GemPickerSheet
        visible={gemSheetOpen}
        onClose={() => setGemSheetOpen(false)}
        gems={gems}
        value={gemId}
        onSelect={(gem) => {
          setGemId(gem.id);
          setWeightBefore(String(gem.currentWeight));
          setErrors((e) => {
            const next = { ...e };
            delete next.gemId;
            return next;
          });
        }}
      />

      <ProviderPickerSheet
        visible={providerSheetOpen}
        onClose={() => setProviderSheetOpen(false)}
        contacts={contacts}
        value={provider}
        allowedBusinessKinds={["lapidaries"]}
        contactTypeFilter={null}
        onSelect={(selection) => {
          setProvider(selection);
          setErrors((e) => {
            const next = { ...e };
            delete next.provider;
            return next;
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.section },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  chipText: { ...Typography.labelMd },
  footer: { gap: Spacing.lg },
});
