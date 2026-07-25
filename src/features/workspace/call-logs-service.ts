import {
  ensureCallLogPermission,
  getCallLogsAccessState,
  loadDeviceCallLogs,
  type CallLogsAccessState,
} from "@/features/workspace/call-logs-device";
import { normalizePhoneKey } from "@/features/workspace/device-contacts-service";
import {
  businessLogoUrl,
  resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import type { Business, Contact } from "@/types";

export type { CallLogsAccessState };
export { ensureCallLogPermission, getCallLogsAccessState };

export type CallPartyKind = "contact" | "business";

export type MatchedCallLog = {
  id: string;
  number: string;
  dateMs: number;
  durationSec: number;
  type: string;
  country: string;
  partyKind: CallPartyKind;
  partyId: string;
  partyName: string;
  partyPhotoUrl: string | null;
  href: string;
};

const WORKSPACE = "/(marketplace)/(tabs)/workspace";

type PhoneParty = {
  key: string;
  kind: CallPartyKind;
  id: string;
  name: string;
  photoUrl: string | null;
  href: string;
};

function buildPhoneIndex(
  contacts: Contact[],
  businesses: Business[],
): Map<string, PhoneParty> {
  const index = new Map<string, PhoneParty>();

  for (const contact of contacts) {
    for (const raw of [contact.phone, contact.whatsapp]) {
      const key = normalizePhoneKey(raw);
      if (!key || index.has(key)) continue;
      index.set(key, {
        key,
        kind: "contact",
        id: contact.id,
        name: contact.displayName,
        photoUrl: resolvePartyPhotoUrl(contact, businesses),
        href: `${WORKSPACE}/contacts/${contact.id}`,
      });
    }
  }

  for (const business of businesses) {
    const phone = business.contacts?.phone?.value;
    const whatsapp = business.contacts?.whatsapp?.value;
    for (const raw of [phone, whatsapp]) {
      const key = normalizePhoneKey(raw);
      if (!key || index.has(key)) continue;
      index.set(key, {
        key,
        kind: "business",
        id: business.id,
        name: business.businessName,
        photoUrl: businessLogoUrl(business),
        href: `/business/${business.id}`,
      });
    }
  }

  return index;
}

function normalizeCallType(type: string): string {
  const t = type.trim().toUpperCase();
  if (t.includes("MISS")) return "MISSED";
  if (t.includes("OUT")) return "OUTGOING";
  if (t.includes("IN")) return "INCOMING";
  if (t.includes("REJECT")) return "REJECTED";
  if (t.includes("BLOCK")) return "BLOCKED";
  if (t.includes("VOICE")) return "VOICEMAIL";
  return t || "UNKNOWN";
}

/** True when the OS can expose call history (Android only). */
export function isCallLogsSupported(): boolean {
  return process.env.EXPO_OS === "android";
}

/**
 * Load device call logs (Android) and keep only entries that match
 * workspace contacts or verified business public phone numbers.
 * Does not prompt — call {@link ensureCallLogPermission} first when needed.
 */
export async function fetchMatchedCallLogs(
  contacts: Contact[],
  businesses: Business[],
): Promise<{
  access: CallLogsAccessState;
  logs: MatchedCallLog[];
}> {
  const access = await getCallLogsAccessState();
  if (access.status !== "granted") {
    return { access, logs: [] };
  }

  const raw = await loadDeviceCallLogs();
  const index = buildPhoneIndex(contacts, businesses);
  const logs: MatchedCallLog[] = [];

  for (const item of raw) {
    const key = normalizePhoneKey(item.number);
    if (!key) continue;
    const party = index.get(key);
    if (!party) continue;

    const dateMs = Number(item.date);
    if (!Number.isFinite(dateMs)) continue;

    logs.push({
      id: `${item.date}-${item.number}-${item.type}-${item.duration}`,
      number: item.number,
      dateMs,
      durationSec: Math.max(0, Number(item.duration) || 0),
      type: normalizeCallType(item.type),
      country: item.country ?? "",
      partyKind: party.kind,
      partyId: party.id,
      partyName: party.name,
      partyPhotoUrl: party.photoUrl,
      href: party.href,
    });
  }

  logs.sort((a, b) => b.dateMs - a.dateMs);
  return { access, logs };
}

export function formatCallDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function callTypeLabel(type: string): string {
  switch (type) {
    case "INCOMING":
      return "Incoming";
    case "OUTGOING":
      return "Outgoing";
    case "MISSED":
      return "Missed";
    case "REJECTED":
      return "Rejected";
    case "BLOCKED":
      return "Blocked";
    case "VOICEMAIL":
      return "Voicemail";
    default:
      return type;
  }
}

export function isMissedCallType(type: string): boolean {
  return type === "MISSED" || type === "REJECTED";
}

/** Missed / rejected calls from today's calendar day only (local time). */
export function countMissedCalls(logs: MatchedCallLog[]): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  return logs.reduce((n, log) => {
    if (!isMissedCallType(log.type)) return n;
    if (log.dateMs < todayMs) return n;
    return n + 1;
  }, 0);
}
