import * as Linking from "expo-linking";

import type { SyncCommitment } from "./commitments";

export function commitmentDeepLink(
  type: SyncCommitment["sourceType"],
  id: string,
): string {
  const encodedId = encodeURIComponent(id);
  const paths: Record<SyncCommitment["sourceType"], string> = {
    trip: `workspace/trips/${encodedId}`,
    cheque: `workspace/cheques/${encodedId}`,
    bill: `workspace/bills/${encodedId}`,
    ap: `workspace/ap/${encodedId}`,
    service: `workspace/services/${encodedId}`,
    payable: "money/payables",
    receivable: "money/receivables",
  };
  return Linking.createURL(paths[type]);
}
