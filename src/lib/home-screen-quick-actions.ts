import type { RouterAction } from "expo-quick-actions/router";
import { Platform, type ColorSchemeName } from "react-native";

import { resolveProfileRole } from "@/constants/roles";
import type { UserProfile, UserRole } from "@/types";

/** Base keys registered as `shortcut_<key>_light` / `_dark` in the config plugin. */
const AndroidIconKey = {
  gem: "gem",
  add: "add",
  ap: "ap",
  service: "service",
  jobs: "jobs",
  contacts: "contacts",
  bill: "bill",
  money: "money",
  market: "market",
  search: "search",
} as const;

type AndroidIconKeyName = (typeof AndroidIconKey)[keyof typeof AndroidIconKey];

/**
 * iOS: outline SF Symbols / built-ins (already theme-adaptive).
 * Android: transparent mipmaps — black in light theme, white in dark.
 */
function icon(
  ios: string,
  androidKey: AndroidIconKeyName,
  scheme: "light" | "dark",
): string {
  if (Platform.OS === "ios") return ios;
  return `shortcut_${androidKey}_${scheme}`;
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

function resolveScheme(colorScheme: ColorSchemeName): "light" | "dark" {
  return colorScheme === "dark" ? "dark" : "light";
}

/** Guest / signed-out: public GemNet entry points. Search last (iOS convention). */
function guestActions(scheme: "light" | "dark"): RouterAction[] {
  return [
    action(
      "certificate-portals",
      "Certificate portals",
      "/verify-certificate-portals",
      icon("symbol:link", AndroidIconKey.market, scheme),
      "Open external verification pages",
    ),
    action(
      "market",
      "Market",
      "/(marketplace)/(tabs)/market",
      icon("symbol:person.2", AndroidIconKey.market, scheme),
      "Find traders and lapidaries",
    ),
    action(
      "search",
      "Search",
      "/(marketplace)/(tabs)/search",
      icon("search", AndroidIconKey.search, scheme),
    ),
  ];
}

function traderActions(scheme: "light" | "dark"): RouterAction[] {
  return [
    action(
      "add-gem",
      "Gem",
      "/(marketplace)/gems/add",
      icon("symbol:diamond", AndroidIconKey.gem, scheme),
      "Log a stone in GemTrack",
    ),
    action(
      "ap",
      "Give AP",
      "/(marketplace)/ap/add",
      icon("symbol:handshake", AndroidIconKey.ap, scheme),
      "Hand over on approval",
    ),
    action(
      "service",
      "Request service",
      "/(marketplace)/services/add",
      icon("symbol:wrench.and.screwdriver", AndroidIconKey.service, scheme),
      "Cutting, heating & more",
    ),
  ];
}

function lapidaryActions(scheme: "light" | "dark"): RouterAction[] {
  return [
    action(
      "jobs",
      "Jobs",
      "/(marketplace)/(tabs)/workspace/jobs",
      icon("symbol:wrench.and.screwdriver", AndroidIconKey.jobs, scheme),
      "Inbound cutting & treatment work",
    ),
    action(
      "contacts",
      "Contacts",
      "/(marketplace)/(tabs)/workspace/contacts",
      icon("contact", AndroidIconKey.contacts, scheme),
      "Brokers, buyers & partners",
    ),
    action(
      "bill",
      "Add bill",
      "/(marketplace)/bills/add",
      icon("symbol:doc.text", AndroidIconKey.bill, scheme),
      "Record a workshop bill",
    ),
  ];
}

function actionsForRole(
  role: UserRole,
  scheme: "light" | "dark",
): RouterAction[] {
  if (role === "lapidary") return lapidaryActions(scheme);
  return traderActions(scheme);
}

/** Build home-screen quick actions for the current auth state (max 4). */
export function buildHomeScreenQuickActions(
  signedIn: boolean,
  profile: UserProfile | null,
  colorScheme: ColorSchemeName = "light",
): RouterAction[] {
  const scheme = resolveScheme(colorScheme);
  if (!signedIn) return guestActions(scheme);
  return actionsForRole(resolveProfileRole(profile), scheme);
}
