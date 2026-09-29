import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { SyncCommitment } from "./commitments";
import { writeNativeCommitment } from "./native-driver";

export async function writeCommitmentToDevice(
  commitment: SyncCommitment,
): Promise<boolean | null> {
  if (
    Platform.OS === "web" ||
    (commitment.surface === "reminder" && Platform.OS !== "ios")
  ) {
    return null;
  }

  try {
    let permitted = false;
    if (commitment.surface === "calendar") {
      const permission =
        Platform.OS === "ios"
          ? await Calendar.getCalendarPermissions(true)
          : await Calendar.getCalendarPermissions();
      permitted = permission.granted;
      if (!permitted) {
        const requested =
          Platform.OS === "ios"
            ? await Calendar.requestCalendarPermissions(true)
            : await Calendar.requestCalendarPermissions();
        permitted = requested.granted;
      }
    } else {
      permitted = (await Calendar.getRemindersPermissions()).granted;
      if (!permitted) {
        permitted = (await Calendar.requestRemindersPermissions()).granted;
      }
    }

    if (!permitted) return false;
    await writeNativeCommitment(commitment);
    return true;
  } catch {
    return false;
  }
}
