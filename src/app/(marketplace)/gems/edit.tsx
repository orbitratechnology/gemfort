import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { CountryField } from "@/components/ui/country-field";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { MediaAlbumField } from "@/components/ui/media-album-field";
import { MediaField } from "@/components/ui/media-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  AttributePickerField,
  ClarityPickerSheet,
  ColorPickerSheet,
  ColorSwatch,
  GemTypePickerSheet,
  ShapePickerSheet,
  TreatmentPickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import { resolveCurrencyCode } from "@/constants/currencies";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  GEM_CLARITIES,
  GEM_SHAPES,
  GEM_TREATMENTS,
  GEM_TYPES,
  findColorShade,
  formatColorLabel,
  formatOptionLabel,
  formatShapeLabel,
  resolveColorShadeValue,
  resolveOptionValue,
  type GemTreatmentValue,
} from "@/constants/gem-options";
import { subscribeGem } from "@/features/workspace/firestore-subscriptions";
import {
  fetchGem,
  queueGemPhotoUrls,
  updateGemDetails,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from "@/lib/firebase/storage-service";
import { addGemSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { WorkspaceGem } from "@/types";

const MAX_GEM_PHOTOS = 10;

type SheetKey = "type" | "color" | "clarity" | "shape" | "treatment" | null;

function isRemoteUri(uri: string) {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

function mediaFromPhotoUrls(urls: string[]): LocalMedia[] {
  return urls
    .filter((uri) => typeof uri === "string" && uri.length > 0)
    .slice(0, MAX_GEM_PHOTOS)
    .map((uri, index) => ({
      uri,
      kind: "image" as const,
      mimeType: "image/jpeg",
      fileName: `gem-${index + 1}.jpg`,
    }));
}

export default function EditGemScreen() {
  const { colors } = useAppTheme();
  const { gemId } = useLocalSearchParams<{ gemId?: string }>();

  const { data: gem, isLoading } = useFirestoreLiveQuery({
    queryKey: ["gem", gemId],
    queryFn: () => fetchGem(gemId!),
    subscribe: (onData, onError) => subscribeGem(gemId!, onData, onError),
    enabled: !!gemId,
  });

  if (!gemId) {
    return (
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <StackHeader title="Edit gem" closeIcon />
        <ScreenInset>
          <Text style={{ color: colors.error }}>Missing gem.</Text>
        </ScreenInset>
      </View>
    );
  }

  if (isLoading || !gem) {
    return (
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <StackHeader title="Edit gem" closeIcon />
        {isLoading || gem === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScreenInset>
            <Text style={{ color: colors.error }}>Gem not found.</Text>
          </ScreenInset>
        )}
      </View>
    );
  }

  return <EditGemForm key={gem.id} gem={gem} />;
}

function EditGemForm({ gem }: { gem: WorkspaceGem }) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();

  const [title, setTitle] = useState(() => gem.title?.trim() ?? "");
  const [gemType, setGemType] = useState(() => gem.gemType || "sapphire");
  const [originCountry, setOriginCountry] = useState(
    () => gem.originCountry ?? "",
  );
  const [colorShade, setColorShade] = useState(() =>
    resolveColorShadeValue(gem.colorPrimary),
  );
  const [clarity, setClarity] = useState(() =>
    resolveOptionValue(GEM_CLARITIES, gem.clarity),
  );
  const [shape, setShape] = useState(() =>
    resolveOptionValue(GEM_SHAPES, gem.shape),
  );
  const [roughWeight, setRoughWeight] = useState(() =>
    gem.roughWeight != null ? String(gem.roughWeight) : "",
  );
  const [acquisition, setAcquisition] = useState<CurrencyAmountValue>(() => ({
    amount: gem.acquisitionCost != null ? String(gem.acquisitionCost) : "",
    currency: resolveCurrencyCode(gem.acquisitionCurrency),
  }));
  const [treatment, setTreatment] = useState<GemTreatmentValue | "">(
    () =>
      (resolveOptionValue(GEM_TREATMENTS, gem.treatmentStatus) ||
        "") as GemTreatmentValue | "",
  );
  const [photos, setPhotos] = useState<LocalMedia[]>(() =>
    mediaFromPhotoUrls(gem.photoUrls ?? []),
  );
  const [certificate, setCertificate] = useState<LocalMedia | null>(() =>
    gem.certificateUrl
      ? { uri: gem.certificateUrl, kind: "file", fileName: gem.certificateFileName ?? "Certificate / report" }
      : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [showOptional, setShowOptional] = useState(() =>
    Boolean(
      gem.shape ||
        gem.clarity ||
        gem.originCountry ||
        gem.colorPrimary ||
        (gem.treatmentStatus && gem.treatmentStatus !== "natural"),
    ),
  );

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
    return n;
  }, [shape, clarity, originCountry, treatment, colorShade]);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function toggleOptional() {
    if (process.env.EXPO_OS === "ios") {
      await Haptics.selectionAsync();
    }
    setShowOptional((prev) => !prev);
  }

  async function handleSubmit() {
    if (!user) return;
    if (gem.ownerUid !== user.uid) {
      toast.error("You can only edit your own gems.");
      return;
    }

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
      status: "",
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(
        Object.values(result.errors)[0] ?? "Check the highlighted fields.",
      );
      return;
    }
    setErrors({});
    const data = result.data;

    try {
      await withLoading(async () => {
        const stamp = Date.now();
        const remoteUrls = photos
          .map((p) => p.uri)
          .filter((uri) => isRemoteUri(uri));
        const hasLocalPhotos = photos.some((p) => !isRemoteUri(p.uri));
        let photoUrls = remoteUrls;
        let photosDeferred = false;
        let certificateUrl = certificate?.uri ?? null;
        if (certificate && !isRemoteUri(certificate.uri)) {
          certificateUrl = await uploadLocalMedia(
            certificate,
            `gemtrack_gems/${user.uid}/${stamp}_certificate.${extensionForMedia(certificate)}`,
          );
        }

        if (photos.length > 0 && hasLocalPhotos) {
          const uploadTask = Promise.all(
            photos.map((photo, index) => {
              if (isRemoteUri(photo.uri)) return Promise.resolve(photo.uri);
              const ext = extensionForMedia(photo);
              return uploadLocalMedia(
                photo,
                `gemtrack_gems/${user.uid}/${stamp}_${index}.${ext}`,
              );
            }),
          );

          try {
            // Await the real upload — do not race-abandon it (8s was wiping URLs).
            photoUrls = await Promise.race([
              uploadTask,
              new Promise<never>((_, reject) => {
                setTimeout(
                  () => reject(new Error("photo-upload-timeout")),
                  45_000,
                );
              }),
            ]);
          } catch {
            photosDeferred = true;
            // Never blank existing / remote photos when new uploads are slow.
            photoUrls =
              remoteUrls.length > 0 ? remoteUrls : (gem.photoUrls ?? []);
            void uploadTask
              .then((urls) => {
                queueGemPhotoUrls(gem.id, urls);
                queryClient.setQueryData(
                  ["gem", gem.id],
                  (prev: WorkspaceGem | null | undefined) =>
                    prev ? { ...prev, photoUrls: urls } : prev,
                );
                void queryClient.invalidateQueries({ queryKey: ["gems"] });
                void queryClient.invalidateQueries({
                  queryKey: ["gem", gem.id],
                });
              })
              .catch(() => {
                // Offline / hard failure — field edits below still save.
              });
          }
        } else if (photos.length === 0) {
          photoUrls = [];
        }

        const colorLabel = data.colorPrimary
          ? formatColorLabel(data.colorPrimary)
          : "";

        await updateGemDetails(gem.id, user.uid, {
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
          shape: data.shape
            ? formatOptionLabel(GEM_SHAPES, data.shape) || data.shape
            : null,
          isNatural: !data.treatment || data.treatment === "natural",
          treatmentStatus: data.treatment ?? "natural",
          photoUrls,
          certificateUrl,
          certificateFileName: certificate?.fileName ?? null,
        });

        void queryClient.invalidateQueries({ queryKey: ["gems"] });
        void queryClient.invalidateQueries({ queryKey: ["gem", gem.id] });

        toast.success(
          photosDeferred
            ? "Gem updated — photos still uploading in the background"
            : "Gem updated",
        );
        if (router.canGoBack()) router.back();
      }, "Saving gem…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update gem."));
    }
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader title="Edit gem" closeIcon />

      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
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

          <MaskedInput
            label="Weight (ct)"
            mode="weight"
            value={roughWeight}
            onChangeText={(v) => {
              setRoughWeight(v);
              clearField("roughWeight");
            }}
            placeholder="0"
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
              <Text style={[styles.moreTitle, { color: colors.primary }]}>
                {showOptional ? "Hide details" : "More details"}
              </Text>
              <Text style={[styles.moreHint, { color: colors.textMuted }]}>
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
                    <ColorSwatch hex={colorHit.shade.hex} size={36} />
                  ) : (
                    <View
                      style={[
                        styles.placeholderIcon,
                        { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <Icon name="palette" size={18} color={colors.outline} />
                    </View>
                  )
                }
              />
            </Animated.View>
          ) : null}
        </FormSection>

        <FormSection title="Photos">
          <MediaAlbumField
            value={photos}
            onChange={(next) => {
              setPhotos(next);
              clearField("photos");
            }}
            max={MAX_GEM_PHOTOS}
            error={errors.photos}
            emptyTitle="Add photos"
            emptySubtitle="Optional — needs network to upload"
          />
        </FormSection>
        <FormSection title="Certificate / Report">
          <MediaField
            value={certificate}
            onChange={setCertificate}
            allows="imagesOrDocuments"
            emptyTitle="Add certificate or report"
            emptySubtitle="Optional — a report makes this gem certified"
          />
        </FormSection>
      </ThemedScrollView>

      <FormFooter
        title="Save changes"
        icon="check"
        onPress={() => void handleSubmit()}
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
  loading: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
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
});
