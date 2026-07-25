import { Platform } from "react-native";
import type { RouterAction } from "expo-quick-actions/router";

import { resolveProfileRole } from "@/constants/roles";
import type { UserProfile, UserRole } from "@/types";

/** Android adaptive icons registered in the expo-quick-actions config plugin. */
const AndroidIcon = {
  verify: "shortcut_verify",
  gem: "shortcut_gem",
  add: "shortcut_add",
  ap: "shortcut_ap",
  service: "shortcut_service",
  jobs: "shortcut_jobs",
  contacts: "shortcut_contacts",
  bill: "shortcut_bill",
  certificates: "shortcut_certificates",
  money: "shortcut_money",
  directory: "shortcut_directory",
  search: "shortcut_search",
  news: "shortcut_news",
} as const;

/** iOS: SF Symbols (`symbol:`) or built-in shortcut types (`search`, `add`, …). */
function icon(ios: string, android: string): string {
  return Platform.OS === "ios" ? ios : android;
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
const GUEST_ACTIONS: RouterAction[] = [
  action(
    "verify",
    "Verify certificate",
    "/verify-certificate",
    icon("symbol:checkmark.seal.fill", AndroidIcon.verify),
    "Check a lab certificate",
  ),
  action(
    "directory",
    "Directory",
    "/(marketplace)/(tabs)/directory",
    icon("symbol:person.2.fill", AndroidIcon.directory),
    "Find traders, lapidaries & labs",
  ),
  action(
    "news",
    "Gem news",
    "/news",
    icon("symbol:newspaper.fill", AndroidIcon.news),
  ),
  action(
    "search",
    "Search",
    "/(marketplace)/(tabs)/search",
    icon("search", AndroidIcon.search),
  ),
];

const TRADER_ACTIONS: RouterAction[] = [
  action(
    "verify",
    "Verify certificate",
    "/verify-certificate",
    icon("symbol:checkmark.seal.fill", AndroidIcon.verify),
    "Check a lab certificate",
  ),
  action(
    "add-gem",
    "Add gem",
    "/(marketplace)/gems/add",
    icon("symbol:diamond.fill", AndroidIcon.gem),
    "Log a stone in GemTrack",
  ),
  action(
    "ap",
    "Give AP",
    "/(marketplace)/ap/add",
    icon("symbol:handshake", AndroidIcon.ap),
    "Hand over on approval",
  ),
  action(
    "service",
    "Request service",
    "/(marketplace)/services/add",
    icon("symbol:wrench.and.screwdriver.fill", AndroidIcon.service),
    "Cutting, heating & more",
  ),
];

const LAPIDARY_ACTIONS: RouterAction[] = [
  action(
    "verify",
    "Verify certificate",
    "/verify-certificate",
    icon("symbol:checkmark.seal.fill", AndroidIcon.verify),
    "Check a lab certificate",
  ),
  action(
    "jobs",
    "Jobs",
    "/(marketplace)/(tabs)/workspace/jobs",
    icon("symbol:wrench.and.screwdriver.fill", AndroidIcon.jobs),
    "Inbound cutting & treatment work",
  ),
  action(
    "contacts",
    "Contacts",
    "/(marketplace)/(tabs)/workspace/contacts",
    icon("symbol:person.crop.circle.fill", AndroidIcon.contacts),
    "Brokers, buyers & partners",
  ),
  action(
    "bill",
    "Add bill",
    "/(marketplace)/bills/add",
    icon("symbol:doc.text.fill", AndroidIcon.bill),
    "Record a workshop bill",
  ),
];

const GEM_LAB_ACTIONS: RouterAction[] = [
  action(
    "verify",
    "Verify certificate",
    "/verify-certificate",
    icon("symbol:checkmark.seal.fill", AndroidIcon.verify),
    "Public certificate check",
  ),
  action(
    "certificates",
    "Certificates",
    "/(marketplace)/(tabs)/workspace/certificates",
    icon("symbol:rosette", AndroidIcon.certificates),
    "Issued reports",
  ),
  action(
    "add-certificate",
    "Issue certificate",
    "/(marketplace)/(tabs)/workspace/certificates/add",
    icon("symbol:plus.rectangle.on.folder.fill", AndroidIcon.add),
    "Create a new report",
  ),
  action(
    "money",
    "Money",
    "/(marketplace)/(tabs)/money",
    icon("symbol:banknote.fill", AndroidIcon.money),
    "Receivables & payments",
  ),
];

function actionsForRole(role: UserRole): RouterAction[] {
  if (role === "lapidary") return LAPIDARY_ACTIONS;
  if (role === "gem_lab") return GEM_LAB_ACTIONS;
  // trader + admin use full trader shortcuts
  return TRADER_ACTIONS;
}

/** Build home-screen quick actions for the current auth state (max 4). */
export function buildHomeScreenQuickActions(
  signedIn: boolean,
  profile: UserProfile | null,
): RouterAction[] {
  if (!signedIn) return GUEST_ACTIONS;
  return actionsForRole(resolveProfileRole(profile));
}
