import { Redirect, useLocalSearchParams } from "expo-router";

/** Keeps the short public `/l/:slug` share URL aligned with the listing screen. */
export default function SharedListingRoute() {
  const { slug } = useLocalSearchParams<{ slug: string | string[] }>();
  const resolvedSlug = Array.isArray(slug) ? slug[0] : slug;

  if (!resolvedSlug) return <Redirect href="/" />;

  return (
    <Redirect
      href={{ pathname: "/listing/[slug]", params: { slug: resolvedSlug } }}
    />
  );
}
