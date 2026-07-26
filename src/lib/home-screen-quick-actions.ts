import { Platform, type ColorSchemeName } from "react-native";
import type { RouterAction } from "expo-quick-actions/router";

import { resolveProfileRole } from "@/constants/roles";
import type { UserProfile, UserRole } from "@/types";

/** Base keys registered as `shortcut_<key>_light` / `_dark` in the config plugin. */
const AndroidIconKey = {
  verify: "verify",
  gem: "gem",
  add: "add",
  ap: "ap",
  service: "service",
  jobs: "jobs",
  contacts: "contacts",
  bill: "bill",
  certificates: "certificates",
  money: "money",
  directory: "directory",
  search: "search",
  news: "news",
} as const;

type AndroidIconKeyName =
  (typeof AndroidIconKey)[keyof typeof AndroidIconKey];

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
      "verify",
      "Verify certificate",
      "/verify-certificate",
      icon("symbol:checkmark.seal", AndroidIconKey.verify, scheme),
      "Check a lab certificate",
    ),
    action(
      "directory",
      "Directory",
      "/(marketplace)/(tabs)/directory",
      icon("symbol:person.2", AndroidIconKey.directory, scheme),
      "Find traders, lapidaries & labs",
    ),
    action(
      "news",
      "Gem news",
      "/news",
      icon("symbol:newspaper", AndroidIconKey.news, scheme),
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
      "verify",
      "Verify certificate",
      "/verify-certificate",
      icon("symbol:checkmark.seal", AndroidIconKey.verify, scheme),
      "Check a lab certificate",
    ),
    action(
      "add-gem",
      "Add gem",
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
      "verify",
      "Verify certificate",
      "/verify-certificate",
      icon("symbol:checkmark.seal", AndroidIconKey.verify, scheme),
      "Check a lab certificate",
    ),
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

function gemLabActions(scheme: "light" | "dark"): RouterAction[] {
  return [
    action(
      "verify",
      "Verify certificate",
      "/verify-certificate",
      icon("symbol:checkmark.seal", AndroidIconKey.verify, scheme),
      "Public certificate check",
    ),
    action(
      "certificates",
      "Certificates",
      "/(marketplace)/(tabs)/workspace/certificates",
      icon("symbol:rosette", AndroidIconKey.certificates, scheme),
      "Issued reports",
    ),
    action(
      "add-certificate",
      "Issue certificate",
      "/(marketplace)/(tabs)/workspace/certificates/add",
      icon("add", AndroidIconKey.add, scheme),
      "Create a new report",
    ),
    action(
      "money",
      "Money",
      "/(marketplace)/(tabs)/money",
      icon("symbol:banknote", AndroidIconKey.money, scheme),
      "Receivables & payments",
    ),
  ];
}

function actionsForRole(
  role: UserRole,
  scheme: "light" | "dark",
): RouterAction[] {
  if (role === "lapidary") return lapidaryActions(scheme);
  if (role === "gem_lab") return gemLabActions(scheme);
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
