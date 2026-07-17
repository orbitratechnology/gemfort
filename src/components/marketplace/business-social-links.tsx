import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6/static';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Radius, Typography } from '@/constants/design-tokens';
import {
  hasAnySocialLink,
  socialProfileUrl,
  websiteFaviconUrls,
  websiteHostname,
  type BusinessSocialLinks,
  type SocialPlatform,
} from '@/features/marketplace/business-links';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/providers/toast-provider';

type SocialLinksRowProps = {
  links: BusinessSocialLinks | null | undefined;
  /** Show a website chip with favicon when set. Default true. */
  showWebsite?: boolean;
};

type PlatformDef = {
  key: keyof BusinessSocialLinks;
  label: string;
  brand?: 'instagram' | 'tiktok' | 'facebook' | 'weixin';
  color: string;
};

const PLATFORMS: PlatformDef[] = [
  { key: 'instagram', label: 'Instagram', brand: 'instagram', color: '#E4405F' },
  { key: 'tiktok', label: 'TikTok', brand: 'tiktok', color: '#111111' },
  { key: 'facebook', label: 'Facebook', brand: 'facebook', color: '#1877F2' },
  { key: 'wechat', label: 'WeChat', brand: 'weixin', color: '#07C160' },
];

const FAVICON_DEBOUNCE_MS = 400;

function Favicon({
  url,
  size = 20,
  fallback,
}: {
  url: string;
  size?: number;
  fallback?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const host = websiteHostname(url);
  const candidates = useMemo(() => websiteFaviconUrls(url), [url]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [trackedUrl, setTrackedUrl] = useState(url);

  // Reset when the URL changes — stale failed/index state was why previews
  // often stopped showing after editing the field. Adjust during render
  // (React-recommended) instead of setState-in-effect.
  if (url !== trackedUrl) {
    setTrackedUrl(url);
    setIndex(0);
    setFailed(false);
  }

  const src = !failed && candidates[index] ? candidates[index] : null;

  if (!host || !src) {
    return fallback ?? <Icon name="language" size={size} color={colors.primary} />;
  }

  return (
    <Image
      key={`${url}-${index}`}
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: 4 }}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={`favicon-${host}-${index}`}
      onError={() => {
        if (index + 1 < candidates.length) setIndex((i) => i + 1);
        else setFailed(true);
      }}
    />
  );
}

/** Tappable social / website icons for public business profiles. */
export function BusinessSocialLinksRow({ links, showWebsite = true }: SocialLinksRowProps) {
  const { colors } = useAppTheme();
  const toast = useToast();

  if (!hasAnySocialLink(links)) return null;

  const website = links?.website?.trim();
  const websiteUrl = website ? socialProfileUrl('website', website) : null;
  const host = websiteHostname(website);

  async function openWeChat(id: string) {
    await Clipboard.setStringAsync(id);
    toast.success('WeChat ID copied');
  }

  return (
    <View style={styles.row}>
      {showWebsite && websiteUrl && host ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Website ${host}`}
          onPress={() => Linking.openURL(websiteUrl)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              opacity: pressed ? 0.88 : 1,
            },
          ]}>
          <Favicon url={websiteUrl} size={18} />
          <Text style={[styles.chipLabel, { color: colors.onSurface }]} numberOfLines={1}>
            {host}
          </Text>
          <Icon name="open-in-new" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {PLATFORMS.map((p) => {
        const value = links?.[p.key]?.trim();
        if (!value) return null;

        if (p.key === 'wechat') {
          return (
            <Pressable
              key={p.key}
              accessibilityRole="button"
              accessibilityLabel={`Copy WeChat ID ${value}`}
              onPress={() => void openWeChat(value)}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <FontAwesome6 name={p.brand!} iconStyle="brand" size={20} color={p.color} />
            </Pressable>
          );
        }

        const href = socialProfileUrl(p.key as 'instagram' | 'tiktok' | 'facebook', value);
        if (!href) return null;

        return (
          <Pressable
            key={p.key}
            accessibilityRole="link"
            accessibilityLabel={`Open ${p.label}`}
            onPress={() => Linking.openURL(href)}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            <FontAwesome6 name={p.brand!} iconStyle="brand" size={20} color={p.color} />
          </Pressable>
        );
      })}
    </View>
  );
}

type SocialLinkFieldProps = {
  platform: SocialPlatform;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  helperText?: string;
} & Pick<ComponentProps<typeof Input>, 'autoCapitalize' | 'autoCorrect' | 'keyboardType'>;

const FIELD_BRAND: Record<
  Exclude<SocialPlatform, 'website'>,
  { name: 'instagram' | 'tiktok' | 'facebook' | 'weixin'; color: string }
> = {
  instagram: { name: 'instagram', color: '#E4405F' },
  tiktok: { name: 'tiktok', color: '#111111' },
  facebook: { name: 'facebook', color: '#1877F2' },
  wechat: { name: 'weixin', color: '#07C160' },
};

/**
 * Website / social edit field: favicon replaces the default left icon when a
 * link is detected; open-in-new appears on the right when a URL can be opened.
 * Preview detection is debounced so favicon fetches aren't fired every keystroke.
 */
export function SocialLinkField({
  platform,
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  ...inputProps
}: SocialLinkFieldProps) {
  const { colors, isDark } = useAppTheme();
  const toast = useToast();
  const debouncedValue = useDebouncedValue(value.trim(), FAVICON_DEBOUNCE_MS);

  const openHref =
    platform === 'wechat' ? null : socialProfileUrl(platform, debouncedValue);

  /** Prefer normalized URL for favicon so host parsing is stable. */
  const faviconUrl =
    platform === 'website'
      ? openHref ?? debouncedValue
      : openHref ?? (/^https?:\/\//i.test(debouncedValue) ? debouncedValue : '');

  const showFavicon = !!websiteHostname(faviconUrl);

  const brand = platform === 'website' ? null : FIELD_BRAND[platform];
  const brandColor =
    brand?.name === 'tiktok' && !isDark ? colors.onSurface : brand?.color;

  const defaultLeft =
    platform === 'website' ? (
      <Icon name="language" size={20} color={colors.textMuted} />
    ) : (
      <FontAwesome6 name={brand!.name} iconStyle="brand" size={20} color={brandColor} />
    );

  const leftElement =
    showFavicon && faviconUrl ? (
      <Favicon key={websiteHostname(faviconUrl) ?? faviconUrl} url={faviconUrl} size={20} fallback={defaultLeft} />
    ) : (
      defaultLeft
    );

  const rightElement =
    platform === 'wechat' && value.trim() ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy WeChat ID"
        hitSlop={8}
        onPress={() => {
          void Clipboard.setStringAsync(value.trim()).then(() =>
            toast.success('WeChat ID copied'),
          );
        }}
        style={({ pressed }) => [styles.fieldAction, pressed && { opacity: 0.7 }]}>
        <Icon name="content-copy" size={20} color={colors.primary} />
      </Pressable>
    ) : openHref ? (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${label}`}
        hitSlop={8}
        onPress={() => Linking.openURL(openHref)}
        style={({ pressed }) => [styles.fieldAction, pressed && { opacity: 0.7 }]}>
        <Icon name="open-in-new" size={20} color={colors.primary} />
      </Pressable>
    ) : null;

  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      helperText={helperText}
      leftElement={leftElement}
      rightElement={rightElement}
      {...inputProps}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipLabel: { ...Typography.labelMd, fontWeight: '600', flexShrink: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});
