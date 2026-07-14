/**
 * Helpers for business website + social profile links.
 * Accepts full URLs or bare handles / IDs.
 */

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook' | 'wechat' | 'website';

export type BusinessSocialLinks = {
  website?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  wechat?: string;
};

function stripHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/^\/+/, '');
}

/** Extract hostname from a website URL or bare domain. */
export function websiteHostname(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, '');
    return host || null;
  } catch {
    return null;
  }
}

/** Favicon candidates (try in order; UI falls back). */
export function websiteFaviconUrls(raw: string | null | undefined, size = 64): string[] {
  const host = websiteHostname(raw);
  if (!host) return [];
  const encoded = encodeURIComponent(host);
  return [
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=${size}`,
  ];
}

export function normalizeWebsiteUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const url = new URL(withProto);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Resolve a tappable URL for a social handle or URL. WeChat returns null (ID only). */
export function socialProfileUrl(
  platform: Exclude<SocialPlatform, 'wechat'>,
  raw: string | null | undefined,
): string | null {
  const v = raw?.trim();
  if (!v) return null;

  if (platform === 'website') return normalizeWebsiteUrl(v);

  if (/^https?:\/\//i.test(v)) return v;

  const handle = stripHandle(v);
  if (!handle) return null;

  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'facebook':
      return `https://www.facebook.com/${handle}`;
    default:
      return null;
  }
}

export function compactSocialLinks(
  links: BusinessSocialLinks | null | undefined,
): BusinessSocialLinks {
  const out: BusinessSocialLinks = {};
  if (links?.website?.trim()) out.website = links.website.trim();
  if (links?.instagram?.trim()) out.instagram = links.instagram.trim();
  if (links?.tiktok?.trim()) out.tiktok = links.tiktok.trim();
  if (links?.facebook?.trim()) out.facebook = links.facebook.trim();
  if (links?.wechat?.trim()) out.wechat = links.wechat.trim();
  return out;
}

export function hasAnySocialLink(links: BusinessSocialLinks | null | undefined): boolean {
  return Object.keys(compactSocialLinks(links)).length > 0;
}
