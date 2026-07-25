import { PermissionsAndroid } from "react-native";

/** Local shape — keep the Android package out of the shared TS graph. */
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

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const FETCH_LIMIT = 400;

export async function getCallLogsAccessState(): Promise<CallLogsAccessState> {
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  );
  return { status: granted ? "granted" : "denied" };
}

export async function ensureCallLogPermission(): Promise<CallLogsAccessState> {
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

export async function loadDeviceCallLogs(): Promise<DeviceCallLog[]> {
  const CalllogsAndroid = (
    await import("react-native-calllogs-android")
  ).default;
  return CalllogsAndroid.getAllLogs({
    fromEpoch: Date.now() - LOOKBACK_MS,
    limit: FETCH_LIMIT,
  });
}
