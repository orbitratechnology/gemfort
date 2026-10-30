import { Image } from "expo-image";
import { Link, router, type Href } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { CountryFlag } from "@/components/ui/country-flag";
import { Icon } from "@/components/ui/icon";
import {
  ContextActionsLink,
  type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemCertificateBadge } from "@/components/workspace/gem-certificate";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import {
  findColorShade,
  formatGemType,
  formatShapeLabel,
  resolveCountryCode,
} from "@/constants/gem-options";
import {
  formatLifecycleSummary,
  resolveGemLifecycle,
  resolveGemSaleStatus,
} from "@/features/workspace/gem-lifecycle";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { shortGemId } from "@/lib/utils";
import { confirmDelete } from "@/providers/confirm-bridge";
import type { WorkspaceGem } from "@/types";

/** Soft cap so tiles stay product-sized on tablets / wide layouts. */
export const GEM_CARD_MAX_WIDTH = 188;

type GemCardProps = {
  gem: WorkspaceGem;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  /** Unread marketplace offer count for this gem's listing. */
  offerBadge?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Workspace inventory tile for 2-column grids. The image (or, without a
 * photo, the gem type's artwork on its own colour) takes most of the card so
 * stones are recognisable at a glance; weight, status, origin and
 * certification sit on it, with name, specs and price below.
 */
export function GemCard({
  gem,
  href,
  onEdit,
  onDelete,
  offerBadge = 0,
  style,
}: GemCardProps) {
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const photo = gemPrimaryPhotoUrl(gem);
  const saleStatus = resolveGemSaleStatus(gem);
  const lifecycle = resolveGemLifecycle(gem);
  const isSold = saleStatus === "sold" || lifecycle.outcome === "sold";
  const { price, priceLabel } =
    gem.soldPrice != null && isSold
      ? {
          priceLabel: "Sold",
          price: formatStored({
            amount: gem.soldPrice,
            currency: gem.soldPriceCurrency ?? gem.totalCostCurrency,
            amountBase: gem.soldPriceBase,
          }),
        }
      : gem.askingPrice != null
        ? {
            priceLabel: "Asking",
            price: formatStored({
              amount: gem.askingPrice,
              currency: gem.askingPriceCurrency ?? gem.totalCostCurrency,
              amountBase: gem.askingPriceBase,
            }),
          }
        : { priceLabel: "Cost", price: formatBase(gem.totalCost) };

  const typeLabel = formatGemType(gem.gemType);
  const gemTitle = gem.title?.trim() || typeLabel;
  const statusLabel = formatLifecycleSummary(lifecycle);
  const statusTone = isSold || lifecycle.outcome === "returned"
    ? STATUS_DOT.closed
    : lifecycle.outcome === "listed" || gem.isListedOnMarketplace
      ? STATUS_DOT.listed
      : lifecycle.custody
        ? STATUS_DOT.away
        : STATUS_DOT.stock;
  const soldTraderName =
    gem.soldToBusinessName?.split(" · ")[0]?.trim() ||
    gem.soldToName?.split(" · ")[0]?.trim() ||
    "Trader";
  const hasOriginFlag = !!resolveCountryCode(gem.originCountry);
  const caratLabel = `${formatCarat(gem.currentWeight)} ct`;
  const colorHit = gem.colorPrimary ? findColorShade(gem.colorPrimary) : null;
  // "Sapphire · Oval · Royal Blue" — what the stone is, at a glance.
  const specs = [
    gem.title?.trim() ? typeLabel : null,
    formatShapeLabel(gem.shape) || null,
    colorHit ? colorHit.shade.label.replace(/\s*\(.*\)$/, "") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Without a photo, the stone's own type artwork on its colour keeps every
  // card recognisable instead of a wall of identical placeholders.
  // Without a photo, the stone's own type artwork on its colour keeps every
  // card recognisable instead of a wall of identical placeholders.
  const media = photo ? (
    <Image source={{ uri: photo }} style={styles.image} contentFit="cover" />
  ) : (
    <GemArtwork gem={gem} style={styles.image} />
  );

  const body = (
    <>
      <View style={styles.media}>
        {href ? <Link.AppleZoom>{media}</Link.AppleZoom> : media}

        <View style={[styles.pill, styles.statusPill]}>
          <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
          <Text style={styles.statusText} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>

        <View style={[styles.pill, styles.caratPill]}>
          <Text style={styles.caratText} numberOfLines={1}>
            {caratLabel}
          </Text>
        </View>

        {hasOriginFlag || gem.certificate?.url ? (
          <View style={styles.badgeRow}>
            {hasOriginFlag ? (
              <View style={styles.flagWrap}>
                <CountryFlag country={gem.originCountry} size="xs" />
              </View>
            ) : null}
            {gem.certificate?.url ? <GemCertificateBadge compact /> : null}
          </View>
        ) : null}

        {offerBadge > 0 ? (
          <View
            style={[styles.offerBadge, { backgroundColor: colors.error }]}
            accessibilityLabel={`${offerBadge} unread offers`}
          >
            <Icon name="local-offer" size={11} color="#FFFFFF" />
            <Text style={styles.offerBadgeText}>
              {offerBadge > 99 ? "99+" : String(offerBadge)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
          {gemTitle}
        </Text>
        {specs ? (
          <Text style={[styles.specs, { color: colors.textMuted }]} numberOfLines={1}>
            {specs}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text
            style={[styles.price, { color: colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {price}
          </Text>
          <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
            {priceLabel}
          </Text>
        </View>

        {isSold && gem.soldToBusinessId ? (
          <Pressable
            style={[styles.saleMeta, { borderTopColor: colors.outlineVariant }]}
            onPress={() =>
              router.push(`/business/${gem.soldToBusinessId}` as never)
            }
            accessibilityRole="button"
            accessibilityLabel={`Open ${soldTraderName} profile`}
          >
            <ContactAvatar
              name={soldTraderName}
              photoUrl={gem.soldToBusinessLogoUrl}
              size={18}
            />
            <Text
              style={[styles.saleMetaName, { color: colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              {soldTraderName}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.outline} />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  const chrome = StyleSheet.flatten([
    styles.card,
    {
      backgroundColor: colors.surfaceContainerLowest,
      boxShadow: `0 1px 2px ${colors.cardShadow}, 0 4px 12px ${colors.cardShadow}`,
    },
    style,
  ]);

  const label = [
    gemTitle,
    specs,
    caratLabel,
    statusLabel,
    `${priceLabel} ${price}`,
    gem.certificate?.url ? "certified" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const actions: ContextMenuAction[] = [];
  if (onEdit) {
    actions.push({
      label: "Edit",
      icon: "square.and.pencil",
      onPress: onEdit,
    });
  }
  if (onDelete) {
    actions.push({
      label: "Delete",
      icon: "trash",
      destructive: true,
      onPress: () =>
        confirmDelete(
          "Delete gem",
          `Remove ${gemTitle} (${shortGemId(gem.id)}) from inventory? This cannot be undone.`,
          onDelete,
        ),
    });
  }

  if (href) {
    return (
      <ContextActionsLink
        href={href}
        accessibilityLabel={label}
        actions={actions}
        style={chrome}
      >
        {({ pressed }) => (
          <View
            style={{
              opacity: pressed ? 0.96 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }}
          >
            {body}
          </View>
        )}
      </ContextActionsLink>
    );
  }

  return (
    <View style={chrome} accessibilityLabel={label}>
      {body}
    </View>
  );
}

/** Status dot colours: soft, muted tones legible on the dark overlay pill. */
const STATUS_DOT = {
  stock: "#8DBFA3",
  listed: "#9FB3CF",
  away: "#D2B27A",
  closed: "#A3A3A3",
} as const;

function formatCarat(weight: number): string {
  if (!Number.isFinite(weight)) return "0";
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(2).replace(/0$/, "");
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  media: {
    width: "100%",
    aspectRatio: 3 / 4,
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  pill: {
    position: "absolute",
    top: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    height: 22,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  statusPill: {
    left: Spacing.sm,
    maxWidth: "62%",
    gap: 5,
    backgroundColor: "rgba(10, 10, 10, 0.62)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    ...text,
    flexShrink: 1,
    color: "#FFFFFF",
    fontFamily: FontFamily.medium,
    fontSize: 10,
    textTransform: "capitalize",
  },
  caratPill: {
    right: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  caratText: {
    ...text,
    color: "#171717",
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  badgeRow: {
    position: "absolute",
    left: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flagWrap: {
    borderRadius: 3,
    overflow: "hidden",
    boxShadow: "0 0 0 1.5px rgba(255, 255, 255, 0.9)",
  },
  offerBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: Radius.full,
  },
  offerBadgeText: {
    ...text,
    color: "#FFFFFF",
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 1,
  },
  title: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  specs: {
    ...text,
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  price: {
    ...text,
    flexShrink: 1,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  priceLabel: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  saleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saleMetaName: {
    ...text,
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
});
