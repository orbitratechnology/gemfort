import type { ImageSource } from "expo-image";

export type WorkspaceEntityKind = "ap" | "service" | "bill" | "trip" | "cheque";

export const WORKSPACE_ENTITY_IMAGES: Record<WorkspaceEntityKind, ImageSource> = {
  ap: require("@/assets/images/ap-icon.png"),
  service: require("@/assets/images/lapidary-icon.png"),
  bill: require("@/assets/images/bill-icon.png"),
  trip: require("@/assets/images/trips-icon.png"),
  cheque: require("@/assets/images/cheque-icon.png"),
};
