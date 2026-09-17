import type { RouterAction } from "expo-quick-actions/router";
import { Platform } from "react-native";

import { resolveProfileRole } from "@/constants/roles";
import type { UserProfile, UserRole } from "@/types";

/** Base keys registered as `shortcut_<key>` in the config plugin. */
const ShortcutKey = {
  app: "app",
  gem: "gem",
  add: "add",
  ap: "ap",
  service: "service",
  jobs: "jobs",
  contacts: "contacts",
  bill: "bill",
  cheque: "cheque",
  money: "money",
  market: "market",
  search: "search",
  certificates: "certificates",
} as const;

type ShortcutKeyName = (typeof ShortcutKey)[keyof typeof ShortcutKey];

/**
 * Prefer native iOS icons for the guest shortcuts. This gives iOS the same
 * familiar visual language as its system actions while Android uses the
 * matching bundled resource registered by the config plugin.
 */
function icon(shortcutKey: ShortcutKeyName): string {
  const assetName = `shortcut_${shortcutKey}`;
  if (Platform.OS === "ios") {
    if (shortcutKey === ShortcutKey.certificates) {
      return "symbol:checkmark.seal";
    }
    if (shortcutKey === ShortcutKey.market) return "symbol:storefront";
    if (shortcutKey === ShortcutKey.search) return "search";
    return `asset:${assetName}`;
  }
  return assetName;
}

function action(
  id: string,
  title: string,
  href: string,
  iconName: string,
  subtitle?: string,
): RouterAction {
  return {
    id,
    title,
    subtitle: subtitle ?? null,
    icon: iconName,
    params: { href },
  };
}

/** Guest / signed-out: public GemNet entry points. Search last (iOS convention). */
function guestActions(): RouterAction[] {
  return [
    action(
      "certificates",
      "Certificates",
      "/verify-certificate-portals",
      icon(ShortcutKey.certificates),
      "Verify gemstone certificates",
    ),
    action(
      "market",
      "Market",
      "/(marketplace)/(tabs)/market",
      icon(ShortcutKey.market),
      "Find traders and lapidaries",
    ),
    action(
      "search",
      "Search",
      "/(marketplace)/(tabs)/search",
      icon(ShortcutKey.search),
    ),
  ];
}

function traderActions(): RouterAction[] {
  return [
    action(
      "add-gem",
      "Gem",
      "/(marketplace)/gems/add",
      icon(ShortcutKey.gem),
      "Log a stone in GemTrack",
    ),
    action(
      "ap",
      "Give AP",
      "/(marketplace)/ap/add",
      icon(ShortcutKey.ap),
      "Hand over on approval",
    ),
    action(
      "service",
      "Request service",
      "/(marketplace)/services/add",
      icon(ShortcutKey.service),
      "Cutting, heating & more",
    ),
  ];
}

function lapidaryActions(): RouterAction[] {
  return [
    action(
      "jobs",
      "Jobs",
      "/(marketplace)/(tabs)/workspace/jobs",
      icon(ShortcutKey.jobs),
      "Inbound cutting & treatment work",
    ),
    action(
      "contacts",
      "Contacts",
      "/(marketplace)/(tabs)/workspace/contacts",
      icon(ShortcutKey.contacts),
      "Traders, buyers & partners",
    ),
    action(
      "bill",
      "Add bill",
      "/(marketplace)/bills/add",
      icon(ShortcutKey.bill),
      "Record a workshop bill",
    ),
    action(
      "cheque",
      "Add cheque",
      "/(marketplace)/cheques/add",
      icon(ShortcutKey.cheque),
      "Track a post-dated cheque",
    ),
  ];
}

function actionsForRole(
  role: UserRole,
): RouterAction[] {
  if (role === "lapidary") return lapidaryActions();
  return traderActions();
}

/** Build home-screen quick actions for the current auth state (max 4). */
export function buildHomeScreenQuickActions(
  signedIn: boolean,
  profile: UserProfile | null,
): RouterAction[] {
  if (!signedIn) return guestActions();
  return actionsForRole(resolveProfileRole(profile));
}
