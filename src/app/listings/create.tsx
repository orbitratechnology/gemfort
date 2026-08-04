import { Image } from "expo-image";
import {
  Redirect,
  router,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { EmptyState } from "@/components/ui/empty-state";
import { FormFooter } from "@/components/ui/form-footer";
import { FormSection } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  AttributePickerField,
  LISTING_VISIBILITY_OPTIONS,
  ListingVisibilityPickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType, formatOptionLabel } from "@/constants/gem-options";
import { fetchBusinessByOwnerUid } from "@/features/marketplace/marketplace-service";
import {
  canListGem,
  isTerminalOutcome,
  resolveGemLifecycle,
} from "@/features/workspace/gem-lifecycle";
import { subscribeGem } from "@/features/workspace/firestore-subscriptions";
import {
  createListing,
  fetchGem,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { friendlyError } from "@/lib/errors";
import { parseAmountInput } from "@/lib/money/mask";
import { copyLink, listingShareUrl, shareLink } from "@/lib/share";
import { openWhatsApp } from "@/lib/utils";
import { parseForm } from "@/lib/validation/form-schemas";
import { replaceWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { confirm, showActions } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import { z } from "zod";

const createListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title needs at least 3 characters")
    .max(80, "Title is too long"),
  price: z
    .string()
    .trim()
    .min(1, "Enter a price")
    .refine(
      (v) => !Number.isNaN(parseAmountInput(v)),
      "Enter a valid price",
    )
    .transform((v) => parseAmountInput(v))
    .refine((n) => n > 0, "Price must be greater than 0"),
  visibility: z.enum(["public", "contacts"], {
    errorMap: () => ({ message: "Choose visibility" }),
  }),
});

type ListingVisibility = "public" | "contacts";

export default function CreateListingScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const { workspaceGemId } = useLocalSearchParams<{
    workspaceGemId?: string;
  }>();
  const gemId = Array.isArray(workspaceGemId)
    ? workspaceGemId[0]
    : workspaceGemId;

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<CurrencyAmountValue>({
    amount: "",
    currency: preferred,
  });
  const [visibility, setVisibility] = useState<ListingVisibility>("public");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [didPrefill, setDidPrefill] = useState(false);

  const isVerifiedSeller =
    profile?.role === "trader" && profile?.verificationStatus === "verified";

  const {
    data: gem,
    isLoading: gemLoading,
    isFetched: gemFetched,
  } = useFirestoreLiveQuery({
    queryKey: ["gem", gemId],
    queryFn: () => fetchGem(gemId!),
    subscribe: (onData, onError) => subscribeGem(gemId!, onData, onError),
    enabled: !!user && !!gemId && isVerifiedSeller,
  });

  if (!didPrefill && gem) {
    const currentTitle =
      gem.title?.trim() ||
      `${formatGemType(gem.gemType)} ${gem.currentWeight}ct`;
    setTitle(currentTitle);
    if (gem.askingPrice != null && gem.askingPrice > 0) {
      setPrice({
        amount: String(gem.askingPrice),
        currency:
          (gem.askingPriceCurrency as CurrencyAmountValue["currency"]) ||
          preferred,
      });
    }
    setDidPrefill(true);
  }

  const visibilityMeta = useMemo(
    () => LISTING_VISIBILITY_OPTIONS.find((o) => o.value === visibility),
    [visibility],
  );

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  if (!isVerifiedSeller) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Sell on Market" />
        <ThemedScrollView contentContainerStyle={styles.blocked}>
          <EmptyState
            icon="verified-user"
            title="Verified sellers only"
            subtitle="Apply for verification from your profile to sell gems on Market."
          />
          <Button
            title="Go to Profile"
            icon="person"
            onPress={() => router.push("/(marketplace)/profile")}
          />
        </ThemedScrollView>
      </SafeAreaView>
    );
  }

  if (!gemId) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Sell on Market" />
        <ThemedScrollView contentContainerStyle={styles.blocked}>
          <EmptyState
            icon="diamond"
            title="No gem selected"
            subtitle="Open a gem in Workspace, then use Sell on Market."
          />
          <Button
            title="Back to gems"
            icon="arrow-back"
            onPress={() =>
              replaceWithAnchor("/(marketplace)/(tabs)/workspace/gems" as Href)
            }
          />
        </ThemedScrollView>
      </SafeAreaView>
    );
  }

  if (gemLoading || !gem) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Sell on Market" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {gemLoading || !gemFetched ? "Loading gem…" : "Gem not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const life = resolveGemLifecycle(gem);
  if (isTerminalOutcome(life.outcome) || !canListGem(gem)) {
    const terminal = isTerminalOutcome(life.outcome);
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Sell on Market" />
        <ThemedScrollView contentContainerStyle={styles.blocked}>
          <EmptyState
            icon={life.outcome === "sold" ? "check-circle" : "block"}
            title={
              life.outcome === "sold"
                ? "Sold gems cannot be sold on Market"
                : life.outcome === "returned"
                  ? "Returned gems cannot be sold on Market"
                  : "This gem cannot be sold on Market"
            }
            subtitle={
              terminal
                ? "Change the outcome first if you need to sell it again."
                : "This gem is already on Market or not ready to sell."
            }
          />
          <Button
            title="Back to gem"
            icon="arrow-back"
            onPress={() =>
              router.replace(
                `/(marketplace)/(tabs)/workspace/gems/${gem.id}` as Href,
              )
            }
          />
        </ThemedScrollView>
      </SafeAreaView>
    );
  }

  async function handlePublish() {
    if (!user || !gem) return;

    const parsed = parseForm(createListingSchema, {
      title,
      price: price.amount,
      visibility,
    });
    if (!parsed.success) {
      setErrors(parsed.errors);
      toast.error(
        Object.values(parsed.errors)[0] ?? "Check the highlighted fields.",
      );
      return;
    }
    setErrors({});
    try {
      await withLoading(async () => {
        const business = await fetchBusinessByOwnerUid(user.uid);
        if (!business) {
          await confirm({
            title: "Business profile required",
            message: "Set up your business profile before selling on Market.",
            confirmLabel: "Set Up",
            cancelLabel: "Cancel",
            icon: "storefront",
            onConfirm: () => {
              router.push("/profile/business" as Href);
            },
          });
          return;
        }

        const { slug } = await createListing(user.uid, business.id, {
          workspaceGemId: gem.id,
          title: parsed.data.title,
          description: null,
          visibility: parsed.data.visibility,
          gemType: gem.gemType,
          caratWeight: gem.currentWeight,
          color: gem.colorPrimary || "—",
          clarity: gem.clarity || null,
          shape: gem.shape || gem.cutType || null,
          origin: gem.originCountry || "Unknown",
          treatmentStatus: gem.treatmentStatus || "natural",
          isCertified: Boolean(gem.certificateUrl),
          certifyingLab: null,
          certificateNumber: null,
          certificateUrl: gem.certificateUrl ?? null,
          certificateFileName: gem.certificateFileName ?? null,
          showPrice: true,
          priceMin: parsed.data.price,
          priceMax: null,
          currency: price.currency,
          photoUrls: gem.photoUrls ?? [],
        });
        const url = listingShareUrl(slug);
        await copyLink(url, { silent: true });
        const whatsapp = business.contacts?.whatsapp?.value;
        toast.success("On Market — link copied.");
        showActions({
          title: "On Market",
          message: `Link copied:\n${url}`,
          actions: [
            ...(whatsapp
              ? [
                  {
                    label: "WhatsApp",
                    onPress: () =>
                      void Linking.openURL(
                        openWhatsApp(
                          whatsapp,
                          `Check out my gem on Market: ${url}`,
                        ),
                      ),
                  },
                ]
              : []),
            {
              label: "Share",
              onPress: () => {
                void shareLink({
                  url,
                  message: `Check out my gem on Market: ${parsed.data.title}`,
                  title: parsed.data.title,
                });
              },
            },
            {
              label: "View",
              onPress: () => router.push(`/listing/${slug}`),
            },
          ],
        });
      }, "Selling on Market…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not sell on Market."));
    }
  }

  const photo = gem.photoUrls?.[0]?.trim() || null;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Sell on Market" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection title="Gem">
          <View
            style={[
              styles.gemCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={styles.gemThumb}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.gemThumb,
                  styles.gemThumbPlaceholder,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Icon
                  name="diamond"
                  size={22}
                  color={colors.onPrimaryContainer}
                />
              </View>
            )}
            <View style={styles.gemText}>
              <Text
                style={[styles.gemTitle, { color: colors.onSurface }]}
                numberOfLines={1}
                selectable={false}
              >
                {gem.title?.trim() || formatGemType(gem.gemType)}
              </Text>
              <Text
                style={[styles.gemMeta, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
                selectable={false}
              >
                {formatGemType(gem.gemType)} · {gem.currentWeight} ct
                {gem.originCountry ? ` · ${gem.originCountry}` : ""}
              </Text>
            </View>
          </View>
        </FormSection>

        <FormSection title="Sale">
          <Input
            label="Title"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              clearField("title");
            }}
            leftIcon="diamond"
            error={errors.title}
            placeholder="e.g. Blue sapphire 2.4ct"
            helperText="Updates the gem title in My Gems when you publish."
          />

          <CurrencyAmountField
            label="Price"
            value={price}
            onChange={(next) => {
              setPrice(next);
              clearField("price");
            }}
            error={errors.price}
            helperText="Shown on the public Market listing"
          />

          <AttributePickerField
            label="Visibility"
            valueLabel={formatOptionLabel(
              LISTING_VISIBILITY_OPTIONS,
              visibility,
            )}
            placeholder="Select visibility"
            onPress={() => setVisibilityOpen(true)}
            error={errors.visibility}
            leading={
              <View
                style={[
                  styles.visIcon,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Icon
                  name={visibilityMeta?.icon ?? "public"}
                  size={18}
                  color={colors.onPrimaryContainer}
                />
              </View>
            }
          />
          <Text style={[styles.helper, { color: colors.textMuted }]}>
            {visibility === "public"
              ? "Anyone on GemFort can find and view this listing."
              : "Only signed-in contacts in your network can view this listing."}
          </Text>
        </FormSection>
      </ThemedScrollView>

      <FormFooter
        title="Sell on Market"
        icon="storefront"
        onPress={() => void handlePublish()}
      />

      <ListingVisibilityPickerSheet
        visible={visibilityOpen}
        onClose={() => setVisibilityOpen(false)}
        value={visibility}
        onSelect={(v) => {
          setVisibility(v as ListingVisibility);
          clearField("visibility");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  blocked: {
    padding: Spacing.xxl,
    gap: Spacing.md,
    flexGrow: 1,
    justifyContent: "center",
  },
  gemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  gemThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  gemThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  gemText: { flex: 1, gap: 2, minWidth: 0 },
  gemTitle: { ...Typography.bodyLg, fontWeight: "700" },
  gemMeta: { ...Typography.bodyMd },
  visIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  helper: { ...Typography.caption, marginTop: -4 },
});
