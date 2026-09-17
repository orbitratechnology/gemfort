/** The Firebase Hosting origin used for public share links. */
export const PUBLIC_WEB_ORIGIN = "https://gemfort.web.app";

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

/** Public listing URL. The `/l` path is kept stable for existing shares. */
export function listingShareUrl(slug: string): string {
  return `${PUBLIC_WEB_ORIGIN}/l/${encodePathSegment(slug)}`;
}

/** Public business profile URL. */
export function businessShareUrl(businessId: string): string {
  return `${PUBLIC_WEB_ORIGIN}/business/${encodePathSegment(businessId)}`;
}
