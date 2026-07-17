import { PermissionsAndroid } from "react-native";
import type { LogData } from "react-native-calllogs-android";

import { normalizePhoneKey } from "@/features/workspace/device-contacts-service";
import type { Business, Contact } from "@/types";

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

export type CallLogsAccessState =
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "granted" };

const WORKSPACE = "/(marketplace)/(tabs)/workspace";
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const FETCH_LIMIT = 400;

function isAndroid() {
  return process.env.EXPO_OS === "android";
}

export async function getCallLogsAccessState(): Promise<CallLogsAccessState> {
  if (!isAndroid()) return { status: "unsupported" };
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  );
  return { status: granted ? "granted" : "denied" };
}

export async function ensureCallLogPermission(): Promise<CallLogsAccessState> {
  if (!isAndroid()) return { status: "unsupported" };

  const current = await getCallLogsAccessState();
  if (current.status === "granted") return current;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    {
      title: "Call history access",
      message:
        "GemFort matches your phone call history with workspace contacts and business profiles so you can see recent calls in one place.",
      buttonNeutral: "Ask later",
      buttonNegative: "Cancel",
      buttonPositive: "Allow",
    },
  );

  return {
    status:
      result === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied",
  };
}

async function loadDeviceCallLogs(): Promise<LogData[]> {
  const CalllogsAndroid = (
    await import("react-native-calllogs-android")
  ).default;
  return CalllogsAndroid.getAllLogs({
    fromEpoch: Date.now() - LOOKBACK_MS,
    limit: FETCH_LIMIT,
  });
}

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
        photoUrl: contact.photoUrl,
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
        photoUrl: null,
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
