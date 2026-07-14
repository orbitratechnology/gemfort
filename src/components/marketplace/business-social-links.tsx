import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6/static';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  hasAnySocialLink,
  socialProfileUrl,
  websiteFaviconUrls,
  websiteHostname,
  type BusinessSocialLinks,
} from '@/features/marketplace/business-links';
import { useAppTheme } from '@/hooks/use-app-theme';
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

function Favicon({ url, size = 20 }: { url: string; size?: number }) {
  const { colors } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const candidates = websiteFaviconUrls(url);
  const [index, setIndex] = useState(0);
  const src = !failed && candidates[index] ? candidates[index] : null;

  if (!src) {
    return <Icon name="language" size={size} color={colors.primary} />;
  }

  return (
    <Image
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: 4 }}
      contentFit="contain"
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
          <Favicon url={website!} size={18} />
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

/** Compact website preview used on the edit form. */
export function WebsiteFaviconPreview({ url }: { url: string }) {
  const { colors } = useAppTheme();
  const host = websiteHostname(url);
  const href = socialProfileUrl('website', url);
  if (!host || !href) return null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${host}`}
      onPress={() => Linking.openURL(href)}
      style={({ pressed }) => [
        styles.preview,
        {
          backgroundColor: colors.surfaceContainerLow,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={[styles.previewIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
        <Favicon url={url} size={22} />
      </View>
      <View style={styles.previewText}>
        <Text style={[styles.previewHost, { color: colors.onSurface }]} numberOfLines={1}>
          {host}
        </Text>
        <Text style={[styles.previewHint, { color: colors.textMuted }]} numberOfLines={1}>
          Opens on your public profile
        </Text>
      </View>
      <Icon name="open-in-new" size={18} color={colors.outline} />
    </Pressable>
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
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    minHeight: 56,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { flex: 1, gap: 2, minWidth: 0 },
  previewHost: { ...Typography.labelMd, fontWeight: '600' },
  previewHint: { ...Typography.bodySmall },
});
