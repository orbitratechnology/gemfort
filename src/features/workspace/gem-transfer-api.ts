import { callApi } from "@/lib/api/api-client";
import type { GemPaymentMethod } from "@/types";

type TransferResult = {
  ok: true;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  requestId?: string;
  gemId: string;
};

function mutationOptions(operation: string, scope: string) {
  return {
    retryAuthOn401: true,
    idempotencyKey: `mobile-gem-${operation}-${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 128),
  } as const;
}

export function createGemTransferRequest(input: {
  gemId: string;
  recipientBusinessId: string;
  recipientContactId?: string | null;
  recipientName: string;
  amount: number;
  currency: string;
  paymentMethod: GemPaymentMethod;
  sourceTripId?: string | null;
  sourceTripGemId?: string | null;
}) {
  const { gemId, ...body } = input;
  return callApi<{ requestId: string; status: "pending" }, typeof body>(
    `/v1/gems/${encodeURIComponent(gemId)}/transfer-requests`,
    body,
    mutationOptions("create-transfer", gemId),
  );
}

export function respondGemTransferRequest(
  requestId: string,
  action: "accepted" | "rejected",
) {
  return callApi<TransferResult, { action: typeof action }>(
    `/v1/gem-transfer-requests/${encodeURIComponent(requestId)}/respond`,
    { action },
    mutationOptions(`respond-transfer-${action}`, requestId),
  );
}

export function cancelGemTransferRequest(requestId: string) {
  return callApi<TransferResult, Record<string, never>>(
    `/v1/gem-transfer-requests/${encodeURIComponent(requestId)}/cancel`,
    {},
    mutationOptions("cancel-transfer", requestId),
  );
}
