import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/ui/media-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
    AttributePickerField,
    ClarityPickerSheet,
    ColorPickerSheet,
    ColorSwatch,
    CutPickerSheet,
    GemTypePickerSheet,
    OriginPickerSheet,
    ShapePickerSheet,
    TreatmentPickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
    GEM_CLARITIES,
    GEM_CUTS,
    GEM_ORIGINS,
    GEM_SHAPES,
    GEM_TREATMENTS,
    GEM_TYPES,
    findColorShade,
    flagUrl,
    formatColorLabel,
    formatGemType,
    formatOptionLabel,
    formatOriginLabel,
    type GemTreatmentValue,
} from "@/constants/gem-options";
import { createGem } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import {
    extensionForMedia,
    uploadLocalMedia,
    type LocalMedia,
} from "@/lib/firebase/storage-service";
import { formatCurrency } from "@/lib/utils";
import { addGemSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const STEPS = ["Details", "Photo", "Review"] as const;

type SheetKey =
  | "type"
  | "color"
  | "clarity"
  | "cut"
  | "shape"
  | "origin"
  | "treatment"
  | null;

export default function AddGemScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [gemType, setGemType] = useState("blue_sapphire");
  const [originValue, setOriginValue] = useState("sri_lanka");
  const [colorShade, setColorShade] = useState("");
  const [clarity, setClarity] = useState("");
  const [cutType, setCutType] = useState("");
  const [shape, setShape] = useState("");
  const [roughWeight, setRoughWeight] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [treatment, setTreatment] = useState<GemTreatmentValue>("natural");
  const [photo, setPhoto] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<SheetKey>(null);

  const selectedType = useMemo(
    () => GEM_TYPES.find((t) => t.value === gemType) ?? GEM_TYPES[0],
    [gemType],
  );
  const selectedOrigin = useMemo(
    () => GEM_ORIGINS.find((o) => o.value === originValue),
    [originValue],
  );
  const colorHit = useMemo(
    () => (colorShade ? findColorShade(colorShade) : null),
    [colorShade],
  );

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateDetails() {
    const originCountry = formatOriginLabel(originValue) || originValue;
    const result = parseForm(addGemSchema, {
      gemType,
      originCountry,
      roughWeight,
      acquisitionCost,
      treatment,
      colorPrimary: colorShade,
      clarity,
      cutType,
      shape,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(
        Object.values(result.errors)[0] ?? "Check the highlighted fields.",
      );
      return null;
    }
    setErrors({});
    return result.data;
  }

  function handleNext() {
    if (step === 0) {
      if (!validateDetails()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    void handleSubmit();
  }

  async function handleSubmit() {
    if (!user) return;
    const data = validateDetails();
    if (!data) {
      setStep(0);
      return;
    }
    setLoading(true);
    try {
      let photoUrls: string[] = [];
      if (photo) {
        const ext = extensionForMedia(photo);
        const url = await uploadLocalMedia(
          photo,
          `gemtrack_gems/${user.uid}/${Date.now()}.${ext}`,
        );
        photoUrls = [url];
      }
      const colorLabel = formatColorLabel(data.colorPrimary);
      const gemId = await createGem(user.uid, {
        gemType: data.gemType,
        originCountry: data.originCountry,
        roughWeight: data.roughWeight,
        acquisitionCost: data.acquisitionCost,
        colorPrimary: colorLabel || data.colorPrimary,
        clarity: formatOptionLabel(GEM_CLARITIES, data.clarity) || data.clarity,
        cutType: formatOptionLabel(GEM_CUTS, data.cutType) || data.cutType,
        shape: formatOptionLabel(GEM_SHAPES, data.shape) || data.shape,
        isNatural: data.treatment === "natural",
        treatmentStatus: data.treatment,
        photoUrls,
      });
      toast.success("Gem added to your inventory");
      router.replace(`/(marketplace)/(tabs)/workspace/gems/${gemId}`);
    } catch (e) {
      toast.error(friendlyError(e, "Could not add gem."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Add gem" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenInset>
          <View style={styles.stepRow}>
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <View key={label} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        active || done
                          ? colors.primary
                          : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  {done ? (
                    <Icon name="check" size={14} color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={[
                        styles.stepNum,
                        {
                          color: active
                            ? colors.onPrimary
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: active || done ? colors.primary : colors.textMuted,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        </ScreenInset>

        {step === 0 ? (
          <>
            <FormSection title="Stone" hint="Type, look, weight, and price.">
              <AttributePickerField
                label="Gem type"
                valueLabel={selectedType.label}
                onPress={() => setSheet("type")}
                error={errors.gemType}
                leading={
                  <Image
                    source={selectedType.image}
                    style={styles.typeThumb}
                    contentFit="cover"
                  />
                }
              />

              <AttributePickerField
                label="Color"
                valueLabel={formatColorLabel(colorShade)}
                placeholder="Select color"
                onPress={() => setSheet("color")}
                error={errors.colorPrimary}
                leading={
                  colorHit ? (
                    <ColorSwatch
                      hex={colorHit.shade.hex}
                      size={36}
                      border={colors.outlineVariant}
                    />
                  ) : (
                    <View
                      style={[
                        styles.placeholderIcon,
                        { backgroundColor: colors.primaryContainer },
                      ]}
                    >
                      <Icon
                        name="palette"
                        size={18}
                        color={colors.onPrimaryContainer}
                      />
                    </View>
                  )
                }
              />

              <View style={styles.row}>
                <View style={styles.flex}>
                  <AttributePickerField
                    label="Clarity"
                    valueLabel={formatOptionLabel(GEM_CLARITIES, clarity)}
                    placeholder="Select"
                    onPress={() => setSheet("clarity")}
                    error={errors.clarity}
                  />
                </View>
                <View style={styles.flex}>
                  <AttributePickerField
                    label="Cut"
                    valueLabel={formatOptionLabel(GEM_CUTS, cutType)}
                    placeholder="Select"
                    onPress={() => setSheet("cut")}
                    error={errors.cutType}
                  />
                </View>
              </View>

              <AttributePickerField
                label="Shape"
                valueLabel={formatOptionLabel(GEM_SHAPES, shape)}
                placeholder="Select shape"
                onPress={() => setSheet("shape")}
                error={errors.shape}
                leading={
                  <View
                    style={[
                      styles.placeholderIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name={
                        GEM_SHAPES.find((s) => s.value === shape)?.icon ??
                        "category"
                      }
                      size={18}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                }
              />

              <AttributePickerField
                label="Origin"
                valueLabel={formatOriginLabel(originValue)}
                placeholder="Select origin"
                onPress={() => setSheet("origin")}
                error={errors.originCountry}
                leading={
                  selectedOrigin ? (
                    <Image
                      source={{ uri: flagUrl(selectedOrigin.countryCode) }}
                      style={styles.flagThumb}
                      contentFit="cover"
                    />
                  ) : undefined
                }
              />

              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input
                    label="Weight (ct)"
                    value={roughWeight}
                    onChangeText={(v) => {
                      setRoughWeight(v);
                      clearField("roughWeight");
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leftIcon="scale"
                    error={errors.roughWeight}
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Purchase price"
                    value={acquisitionCost}
                    onChangeText={(v) => {
                      setAcquisitionCost(v);
                      clearField("acquisitionCost");
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leftIcon="payments"
                    error={errors.acquisitionCost}
                  />
                </View>
              </View>
            </FormSection>

            <FormSection title="Treatment" hint="Natural is the default.">
              <AttributePickerField
                label="Treatment"
                valueLabel={formatOptionLabel(GEM_TREATMENTS, treatment)}
                placeholder="Select treatment"
                onPress={() => setSheet("treatment")}
                error={errors.treatment}
                leading={
                  <Icon
                    name={
                      GEM_TREATMENTS.find((t) => t.value === treatment)?.icon ??
                      "spa"
                    }
                    size={22}
                    color={colors.primary}
                  />
                }
              />
            </FormSection>
          </>
        ) : null}

        {step === 1 ? (
          <FormSection
            title="Photo"
            hint="Optional. Helps you recognise the stone later."
          >
            <MediaField
              value={photo}
              onChange={setPhoto}
              emptyTitle="Add photo"
              emptySubtitle="Kept on device until you save"
            />
          </FormSection>
        ) : null}

        {step === 2 ? (
          <FormSection title="Review">
            <View style={styles.reviewList}>
              <ReviewRow label="Type" value={formatGemType(gemType)} />
              <ReviewRow
                label="Color"
                value={formatColorLabel(colorShade) || "—"}
              />
              <ReviewRow
                label="Clarity"
                value={formatOptionLabel(GEM_CLARITIES, clarity) || "—"}
              />
              <ReviewRow
                label="Cut"
                value={formatOptionLabel(GEM_CUTS, cutType) || "—"}
              />
              <ReviewRow
                label="Shape"
                value={formatOptionLabel(GEM_SHAPES, shape) || "—"}
              />
              <ReviewRow label="Weight" value={`${roughWeight} ct`} />
              <ReviewRow
                label="Price"
                value={formatCurrency(parseFloat(acquisitionCost) || 0)}
              />
              <ReviewRow
                label="Origin"
                value={formatOriginLabel(originValue) || "—"}
              />
              <ReviewRow
                label="Treatment"
                value={formatOptionLabel(GEM_TREATMENTS, treatment) || "—"}
              />
              <ReviewRow label="Photo" value={photo ? "Selected" : "None"} />
            </View>
          </FormSection>
        ) : null}
      </ThemedScrollView>

      <FormFooter
        title={step === 2 ? "Save gem" : "Continue"}
        icon={step === 2 ? "shield" : "arrow-forward"}
        loading={loading}
        onPress={handleNext}
        secondaryTitle={step > 0 ? "Back" : undefined}
        onSecondaryPress={step > 0 ? () => setStep((s) => s - 1) : undefined}
      />

      <GemTypePickerSheet
        visible={sheet === "type"}
        onClose={() => setSheet(null)}
        value={gemType}
        onSelect={(v) => {
          setGemType(v);
          clearField("gemType");
        }}
      />
      <ColorPickerSheet
        visible={sheet === "color"}
        onClose={() => setSheet(null)}
        value={colorShade}
        onSelect={(v) => {
          setColorShade(v);
          clearField("colorPrimary");
        }}
      />
      <ClarityPickerSheet
        visible={sheet === "clarity"}
        onClose={() => setSheet(null)}
        value={clarity}
        onSelect={(v) => {
          setClarity(v);
          clearField("clarity");
        }}
      />
      <CutPickerSheet
        visible={sheet === "cut"}
        onClose={() => setSheet(null)}
        value={cutType}
        onSelect={(v) => {
          setCutType(v);
          clearField("cutType");
        }}
      />
      <ShapePickerSheet
        visible={sheet === "shape"}
        onClose={() => setSheet(null)}
        value={shape}
        onSelect={(v) => {
          setShape(v);
          clearField("shape");
        }}
      />
      <OriginPickerSheet
        visible={sheet === "origin"}
        onClose={() => setSheet(null)}
        value={originValue}
        onSelect={(v) => {
          setOriginValue(v);
          clearField("originCountry");
        }}
      />
      <TreatmentPickerSheet
        visible={sheet === "treatment"}
        onClose={() => setSheet(null)}
        value={treatment}
        onSelect={(v) => {
          setTreatment(v as GemTreatmentValue);
          clearField("treatment");
        }}
      />
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.reviewRow, { borderBottomColor: colors.outlineVariant }]}
    >
      <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.reviewValue, { color: colors.onSurface }]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { ...Typography.caption, fontWeight: "700" },
  stepLabel: { ...Typography.caption, fontWeight: "600" },
  typeThumb: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  flagThumb: {
    width: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#ddd",
  },
  placeholderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: Spacing.md },
  flex: { flex: 1 },
  reviewList: { gap: 0 },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  reviewLabel: { ...Typography.bodyMd },
  reviewValue: {
    ...Typography.bodyLg,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
