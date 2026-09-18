import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

/** Accept only web links so scanned text cannot trigger an arbitrary URI scheme. */
export function normalizeVerificationUrl(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  const candidate = /^https?:\/\//i.test(value)
    ? value
    : /^www\./i.test(value)
      ? `https://${value}`
      : null;

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function openVerificationUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}
