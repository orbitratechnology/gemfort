import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { CountryField } from "@/components/ui/country-field";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MediaAlbumField } from "@/components/ui/media-album-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  AttributePickerField,
  ClarityPickerSheet,
  ColorPickerSheet,
  ColorSwatch,
  GemTypePickerSheet,
  ShapePickerSheet,
  StatusPickerSheet,
  TreatmentPickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import {
  TripPickerSheet,
  TripSelectField,
} from "@/components/workspace/trip-picker-sheet";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  GEM_CLARITIES,
  GEM_SHAPES,
  GEM_TREATMENTS,
  GEM_TYPES,
  MANUAL_STATUS_OPTIONS,
  findColorShade,
  formatColorLabel,
  formatGemStatusLabel,
  formatGemType,
  formatOptionLabel,
  formatShapeLabel,
  type GemTreatmentValue,
} from "@/constants/gem-options";
import {
  subscribeTrip,
  subscribeTrips,
} from "@/features/workspace/firestore-subscriptions";
import {
  createGem,
  createGemOnSourcingTrip,
  fetchTrip,
  fetchTrips,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from "@/lib/firebase/storage-service";
import { formatCurrency } from "@/lib/utils";
import { addGemSchema, parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { GemStatus, Trip } from "@/types";

const STEPS = ["Details", "Photos", "Review"] as const;
const MAX_GEM_PHOTOS = 10;

type SheetKey =
  | "type"
  | "color"
  | "clarity"
  | "shape"
  | "treatment"
  | "status"
  | "trip"
  | null;

function isSourcingTrip(trip: Trip) {
  return trip.tripType === "sourcing" || trip.tripType === "both";
}

function isLinkableTrip(trip: Trip) {
  return (
    isSourcingTrip(trip) &&
    (trip.status === "ongoing" || trip.status === "planning")
  );
}

export default function AddGemScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();
  const { sharedImageUris, tripId: tripIdParam } = useLocalSearchParams<{
    sharedImageUris?: string;
    tripId?: string;
  }>();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [gemType, setGemType] = useState("sapphire");
  const [originCountry, setOriginCountry] = useState("");
  const [colorShade, setColorShade] = useState("");
  const [clarity, setClarity] = useState("");
  const [shape, setShape] = useState("");
  const [roughWeight, setRoughWeight] = useState("");
  const [acquisition, setAcquisition] = useState<CurrencyAmountValue>({
    amount: "",
    currency: preferred,
  });
  const [treatment, setTreatment] = useState<GemTreatmentValue | "">("");
  const [status, setStatus] = useState<GemStatus | "">("");
  /** Index 0 is the primary album image. */
  const [photos, setPhotos] = useState<LocalMedia[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(tripIdParam ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [didApplyShared, setDidApplyShared] = useState(false);
  const [didApplyTripParam, setDidApplyTripParam] = useState(false);
  const [showOptional, setShowOptional] = useState(Boolean(tripIdParam));

  const { data: trips = [] } = useFirestoreLiveQuery({
    queryKey: ["trips", user?.uid],
    queryFn: () => fetchTrips(user!.uid),
    subscribe: (onData, onError) => subscribeTrips(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: paramTrip } = useFirestoreLiveQuery({
    queryKey: ["trip", tripIdParam],
    queryFn: () => fetchTrip(tripIdParam!),
    subscribe: (onData, onError) =>
      subscribeTrip(tripIdParam!, onData, onError),
    enabled: !!tripIdParam && !didApplyTripParam,
  });

  const linkableTrips = useMemo(() => {
    const ongoing = trips.filter(isLinkableTrip);
    if (
      paramTrip &&
      isSourcingTrip(paramTrip) &&
      !ongoing.some((t) => t.id === paramTrip.id)
    ) {
      return [paramTrip, ...ongoing];
    }
    return ongoing;
  }, [trips, paramTrip]);

  const selectedTrip = useMemo(
    () => linkableTrips.find((t) => t.id === selectedTripId) ?? null,
    [linkableTrips, selectedTripId],
  );

  useEffect(() => {
    if (didApplyTripParam || !tripIdParam) return;
    if (paramTrip && isSourcingTrip(paramTrip)) {
      setSelectedTripId(paramTrip.id);
      setDidApplyTripParam(true);
    } else if (paramTrip === null) {
      setDidApplyTripParam(true);
    }
  }, [tripIdParam, paramTrip, didApplyTripParam]);

  useEffect(() => {
    if (didApplyShared || !sharedImageUris) return;
    try {
      const parsed = JSON.parse(sharedImageUris) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const media: LocalMedia[] = parsed
        .filter(
          (uri): uri is string => typeof uri === "string" && uri.length > 0,
        )
        .slice(0, MAX_GEM_PHOTOS)
        .map((uri, index) => ({
          uri,
          kind: "image" as const,
          mimeType: "image/jpeg",
          fileName: `shared-${index + 1}.jpg`,
        }));
      if (media.length === 0) return;
      setPhotos(media);
      setStep(1);
      setDidApplyShared(true);
    } catch {
      // Ignore malformed share params.
    }
  }, [sharedImageUris, didApplyShared]);

  const selectedType = useMemo(
    () => GEM_TYPES.find((t) => t.value === gemType) ?? GEM_TYPES[0],
    [gemType],
  );
  const colorHit = useMemo(
    () => (colorShade ? findColorShade(colorShade) : null),
    [colorShade],
  );
  const selectedShape = useMemo(
    () => GEM_SHAPES.find((s) => s.value === shape),
    [shape],
  );
  const selectedClarity = useMemo(
    () => GEM_CLARITIES.find((c) => c.value === clarity),
    [clarity],
  );

  const optionalFilledCount = useMemo(() => {
    let n = 0;
    if (shape) n += 1;
    if (clarity) n += 1;
    if (originCountry) n += 1;
    if (treatment) n += 1;
    if (colorShade) n += 1;
    if (selectedTripId) n += 1;
    if (!selectedTripId && status) n += 1;
    return n;
  }, [
    shape,
    clarity,
    originCountry,
    treatment,
    colorShade,
    selectedTripId,
    status,
  ]);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateDetails() {
    const result = parseForm(addGemSchema, {
      title,
      gemType,
      originCountry,
      roughWeight,
      acquisitionCost: acquisition.amount,
      treatment,
      colorPrimary: colorShade,
      clarity,
      shape,
      status: selectedTripId ? "on_trip" : status,
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

  function validatePhotos() {
    if (photos.length < 1) {
      setErrors((prev) => ({
        ...prev,
        photos: "Add at least one photo of the gem.",
      }));
      toast.error("Add at least one photo of the gem.");
      return false;
    }
    clearField("photos");
    return true;
  }

  function handlePhotosChange(next: LocalMedia[]) {
    setPhotos(next);
    if (next.length > 0) clearField("photos");
  }

  function handleNext() {
    if (step === 0) {
      if (!validateDetails()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!validatePhotos()) return;
      setStep(2);
      return;
    }
    void handleSubmit();
  }

  async function toggleOptional() {
    if (process.env.EXPO_OS === "ios") {
      await Haptics.selectionAsync();
    }
    setShowOptional((prev) => !prev);
  }

  async function handleSubmit() {
    if (!user) return;
    const data = validateDetails();
    if (!data) {
      setStep(0);
      return;
    }
    if (!validatePhotos()) {
      setStep(1);
      return;
    }
    try {
      await withLoading(async () => {
        const stamp = Date.now();
        const photoUrls = await Promise.all(
          photos.map((photo, index) => {
            const ext = extensionForMedia(photo);
            return uploadLocalMedia(
              photo,
              `gemtrack_gems/${user.uid}/${stamp}_${index}.${ext}`,
            );
          }),
        );
        const colorLabel = data.colorPrimary
          ? formatColorLabel(data.colorPrimary)
          : "";
        const gemPayload = {
          title: data.title,
          gemType: data.gemType,
          originCountry: data.originCountry ?? "",
          roughWeight: data.roughWeight,
          acquisitionCost: data.acquisitionCost,
          acquisitionCurrency: acquisition.currency,
          colorPrimary: colorLabel || data.colorPrimary || null,
          clarity: data.clarity
            ? formatOptionLabel(GEM_CLARITIES, data.clarity) || data.clarity
            : null,
          cutType: null,
          shape: data.shape
            ? formatOptionLabel(GEM_SHAPES, data.shape) || data.shape
            : null,
          isNatural: !data.treatment || data.treatment === "natural",
          treatmentStatus: data.treatment ?? "natural",
          status: data.status,
          photoUrls,
        };

        const gemId = selectedTripId
          ? await createGemOnSourcingTrip(user.uid, selectedTripId, gemPayload)
          : await createGem(user.uid, gemPayload);

        if (selectedTripId) {
          await queryClient.invalidateQueries({
            queryKey: ["trip-gems", selectedTripId],
          });
          await queryClient.invalidateQueries({
            queryKey: ["trip", selectedTripId],
          });
          await queryClient.invalidateQueries({ queryKey: ["trips"] });
        }
        await queryClient.invalidateQueries({ queryKey: ["gems"] });

        toast.success(
          selectedTripId
            ? "Gem added and linked to trip"
            : "Gem added to your inventory",
        );
        replaceWithAnchor(`/(marketplace)/(tabs)/workspace/gems/${gemId}`);
      }, "Adding gem…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not add gem."));
    }
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader title="Add gem" closeIcon />

      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
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
                        color:
                          active || done ? colors.primary : colors.textMuted,
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
          <FormSection title="Stone">
            <Input
              label="Title"
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                clearField("title");
              }}
              placeholder="e.g. Lot A blue oval"
              leftIcon="title"
              error={errors.title}
              autoCapitalize="sentences"
            />

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

            <CurrencyAmountField
              label="Purchase price"
              value={acquisition}
              onChange={(next) => {
                setAcquisition(next);
                clearField("acquisitionCost");
              }}
              error={errors.acquisitionCost}
            />

            <Pressable
              onPress={() => void toggleOptional()}
              accessibilityRole="button"
              accessibilityState={{ expanded: showOptional }}
              style={[
                styles.moreToggle,
                { borderTopColor: colors.outlineVariant },
              ]}
            >
              <View style={styles.moreToggleText}>
                <Text
                  style={[styles.moreTitle, { color: colors.primary }]}
                >
                  {showOptional ? "Hide details" : "More details"}
                </Text>
                <Text
                  style={[styles.moreHint, { color: colors.textMuted }]}
                >
                  {optionalFilledCount > 0
                    ? `${optionalFilledCount} filled · optional`
                    : "Shape, clarity, origin…"}
                </Text>
              </View>
              <Icon
                name={showOptional ? "expand-less" : "expand-more"}
                size={22}
                color={colors.primary}
              />
            </Pressable>

            {showOptional ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                style={styles.optionalBlock}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AttributePickerField
                      label="Shape"
                      valueLabel={formatShapeLabel(shape)}
                      placeholder="Optional"
                      onPress={() => setSheet("shape")}
                      error={errors.shape}
                      leading={
                        <View
                          style={[
                            styles.placeholderIcon,
                            {
                              backgroundColor: selectedShape
                                ? colors.primaryContainer
                                : colors.surfaceContainerHigh,
                            },
                          ]}
                        >
                          <Icon
                            name={selectedShape?.icon ?? "category"}
                            size={18}
                            color={
                              selectedShape
                                ? colors.onPrimaryContainer
                                : colors.outline
                            }
                          />
                        </View>
                      }
                    />
                  </View>
                  <View style={styles.flex}>
                    <AttributePickerField
                      label="Clarity"
                      valueLabel={formatOptionLabel(GEM_CLARITIES, clarity)}
                      placeholder="Optional"
                      onPress={() => setSheet("clarity")}
                      error={errors.clarity}
                      leading={
                        <View
                          style={[
                            styles.placeholderIcon,
                            {
                              backgroundColor: selectedClarity
                                ? colors.primaryContainer
                                : colors.surfaceContainerHigh,
                            },
                          ]}
                        >
                          <Icon
                            name={selectedClarity?.icon ?? "visibility"}
                            size={18}
                            color={
                              selectedClarity
                                ? colors.onPrimaryContainer
                                : colors.outline
                            }
                          />
                        </View>
                      }
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flex}>
                    <CountryField
                      label="Origin"
                      value={originCountry}
                      onChange={(name) => {
                        setOriginCountry(name);
                        clearField("originCountry");
                      }}
                      placeholder="Optional"
                      sheetTitle="Origin"
                      error={errors.originCountry}
                    />
                  </View>
                  <View style={styles.flex}>
                    <AttributePickerField
                      label="Treatment"
                      valueLabel={
                        treatment
                          ? formatOptionLabel(GEM_TREATMENTS, treatment)
                          : ""
                      }
                      placeholder="Optional"
                      onPress={() => setSheet("treatment")}
                      error={errors.treatment}
                    />
                  </View>
                </View>

                <AttributePickerField
                  label="Color"
                  valueLabel={formatColorLabel(colorShade)}
                  placeholder="Optional"
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

                <TripSelectField
                  label="Trip"
                  trip={selectedTrip}
                  placeholder="Optional — link to a trip"
                  onPress={() => setSheet("trip")}
                  onClear={
                    tripIdParam
                      ? undefined
                      : () => {
                          setSelectedTripId("");
                        }
                  }
                />

                {selectedTripId ? null : (
                  <AttributePickerField
                    label="Status"
                    valueLabel={formatGemStatusLabel(status)}
                    placeholder="Optional"
                    onPress={() => setSheet("status")}
                    error={errors.status}
                    leading={
                      <View
                        style={[
                          styles.placeholderIcon,
                          { backgroundColor: colors.primaryContainer },
                        ]}
                      >
                        <Icon
                          name={
                            MANUAL_STATUS_OPTIONS.find(
                              (s) => s.value === status,
                            )?.icon ?? "flag"
                          }
                          size={18}
                          color={colors.onPrimaryContainer}
                        />
                      </View>
                    }
                  />
                )}
              </Animated.View>
            ) : null}
          </FormSection>
        ) : null}

        {step === 1 ? (
          <FormSection title="Photos">
            <MediaAlbumField
              value={photos}
              onChange={handlePhotosChange}
              max={MAX_GEM_PHOTOS}
              error={errors.photos}
              emptyTitle="Add photos"
            />
          </FormSection>
        ) : null}

        {step === 2 ? (
          <FormSection title="Review">
            <View style={styles.reviewList}>
              <ReviewRow label="Title" value={title.trim() || "—"} />
              <ReviewRow label="Type" value={formatGemType(gemType)} />
              <ReviewRow label="Weight" value={`${roughWeight} ct`} />
              <ReviewRow
                label="Price"
                value={formatCurrency(
                  parseFloat(acquisition.amount) || 0,
                  acquisition.currency,
                )}
              />
              <ReviewRow
                label="Shape"
                value={formatShapeLabel(shape) || "—"}
              />
              <ReviewRow
                label="Clarity"
                value={formatOptionLabel(GEM_CLARITIES, clarity) || "—"}
              />
              <ReviewRow
                label="Origin"
                value={originCountry || "—"}
                leading={
                  originCountry ? (
                    <CountryFlag country={originCountry} size="sm" />
                  ) : undefined
                }
              />
              <ReviewRow
                label="Treatment"
                value={
                  treatment
                    ? formatOptionLabel(GEM_TREATMENTS, treatment) || "—"
                    : "—"
                }
              />
              <ReviewRow
                label="Color"
                value={formatColorLabel(colorShade) || "—"}
              />
              <ReviewRow
                label="Trip"
                value={selectedTrip?.tripName ?? "None"}
              />
              <ReviewRow
                label="Status"
                value={
                  selectedTripId
                    ? "Trip"
                    : formatGemStatusLabel(status) || "Rough (default)"
                }
              />
              <ReviewRow
                label="Photos"
                value={
                  photos.length === 0
                    ? "None"
                    : `${photos.length} · primary set`
                }
              />
            </View>
          </FormSection>
        ) : null}
      </ThemedScrollView>

      <FormFooter
        title={step === 2 ? "Save gem" : "Continue"}
        icon={step === 2 ? "shield" : "arrow-forward"}
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
      <ShapePickerSheet
        visible={sheet === "shape"}
        onClose={() => setSheet(null)}
        value={shape}
        onSelect={(v) => {
          setShape(v);
          clearField("shape");
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
      <StatusPickerSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        value={status}
        onSelect={(v) => {
          setStatus(v as GemStatus);
          clearField("status");
        }}
      />
      <TripPickerSheet
        visible={sheet === "trip"}
        onClose={() => setSheet(null)}
        trips={linkableTrips}
        value={selectedTripId}
        onSelect={(trip) => {
          setSelectedTripId(trip.id);
        }}
      />
    </View>
  );
}

function ReviewRow({
  label,
  value,
  leading,
}: {
  label: string;
  value: string;
  leading?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.reviewRow, { borderBottomColor: colors.outlineVariant }]}
    >
      <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.reviewValueRow}>
        {leading}
        <Text
          selectable
          style={[styles.reviewValue, { color: colors.onSurface }]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
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
    borderCurve: "continuous",
  },
  placeholderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: Spacing.md },
  flex: { flex: 1 },
  moreToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  moreToggleText: { flex: 1, gap: 2 },
  moreTitle: { ...Typography.bodyLg, fontWeight: "600" },
  moreHint: { ...Typography.caption },
  optionalBlock: { gap: Spacing.md },
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
  reviewValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  reviewValue: {
    ...Typography.bodyLg,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
