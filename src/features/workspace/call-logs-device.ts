/**
 * Non-Android stub. Metro resolves `call-logs-device.android.ts` on Android,
 * so `react-native-calllogs-android` is never bundled for iOS/web.
 */

export type DeviceCallLog = {
  number: string;
  date: string;
  duration: string;
  country: string;
  type: string;
};

export type CallLogsAccessState =
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "granted" };

export async function getCallLogsAccessState(): Promise<CallLogsAccessState> {
  return { status: "unsupported" };
}

export async function ensureCallLogPermission(): Promise<CallLogsAccessState> {
  return { status: "unsupported" };
}

export async function loadDeviceCallLogs(): Promise<DeviceCallLog[]> {
  return [];
}
