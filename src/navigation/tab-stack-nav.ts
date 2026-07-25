import { router, type Href } from "expo-router";

/** Hub routes for tab stacks that nest screens under an `index` anchor. */
export const WORKSPACE_HUB = "/(marketplace)/(tabs)/workspace" as const;
export const MONEY_HUB = "/(marketplace)/(tabs)/money" as const;

const TAB_HUBS = [
  { segment: "workspace", href: WORKSPACE_HUB },
  { segment: "money", href: MONEY_HUB },
] as const;

/**
 * When a path is a nested screen inside a tab stack (e.g. `/workspace/gems`),
 * return that tab's hub so back can land on the index instead of another tab.
 */
export function nestedTabHubForPathname(pathname: string): Href | null {
  const segments = pathname.split("/").filter(Boolean);
  for (const { segment, href } of TAB_HUBS) {
    const idx = segments.indexOf(segment);
    if (idx !== -1 && segments.length > idx + 1) {
      return href;
    }
  }
  return null;
}

/**
 * Push/navigate into a nested tab stack while keeping the layout `anchor`
 * (usually `index`) underneath — required so back and tab re-tap can reach the hub.
 *
 * @see https://docs.expo.dev/router/basics/navigation/#initial-routes
 */
export function pushWithAnchor(href: Href) {
  router.push(href, { withAnchor: true });
}

export function navigateWithAnchor(href: Href) {
  router.navigate(href, { withAnchor: true });
}

export function replaceWithAnchor(href: Href) {
  router.replace(href, { withAnchor: true });
}

/** True when `href` targets a nested Workspace screen (not the hub itself). */
export function isNestedWorkspaceHref(href: string): boolean {
  return (
    href.includes("/workspace/") &&
    !href.endsWith("/workspace") &&
    !href.includes("/workspace?")
  );
}
