import { callApi, isGemfortApApiCanaryEnabled } from '@/lib/api/api-client';
import type { ApPaymentMethod } from '@/types';

type ApMutationResult = {
  ok: true;
  status?: string;
};

type ApSaleInput = {
  apId: string;
  gemId: string;
  soldPrice: number;
  soldToName?: string;
  paymentDueDateIso?: string | null;
  ownerReceives?: number | null;
};

type ApPaymentSentInput = {
  apId: string;
  method: ApPaymentMethod;
  amount?: number;
  chequeId?: string | null;
  receiptUrl?: string | null;
};

type ApPaymentReceivedInput = {
  apId: string;
  method?: ApPaymentMethod;
  chequeId?: string | null;
  receiptUrl?: string | null;
};

function idempotencyKey(operation: string, apId: string): string {
  const safeApId = apId.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 72);
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `mobile-${operation}-${safeApId || 'ap'}-${nonce}`.slice(0, 128);
}

function mutationOptions(operation: string, apId: string) {
  return {
    retryAuthOn401: true,
    idempotencyKey: idempotencyKey(operation, apId),
  } as const;
}

export function isApMutationApiCanaryEnabled(): boolean {
  return isGemfortApApiCanaryEnabled();
}

export function requestApCancellationViaApi(apId: string) {
  return callApi<ApMutationResult, Record<string, never>>(
    `/v1/ap/${encodeURIComponent(apId)}/cancellation`,
    {},
    mutationOptions('ap-cancel-request', apId),
  );
}

export function respondApCancellationViaApi(
  apId: string,
  action: 'accepted' | 'rejected',
) {
  return callApi<ApMutationResult, { action: 'accepted' | 'rejected' }>(
    `/v1/ap/${encodeURIComponent(apId)}/cancellation/respond`,
    { action },
    mutationOptions(`ap-cancel-${action}`, apId),
  );
}

export function recordApGemSaleViaApi(input: ApSaleInput) {
  const { apId, ...body } = input;
  return callApi<ApMutationResult, Omit<ApSaleInput, 'apId'>>(
    `/v1/ap/${encodeURIComponent(apId)}/sale`,
    body,
    mutationOptions('ap-sale', apId),
  );
}

export function apPaymentSentViaApi(input: ApPaymentSentInput) {
  const { apId, ...body } = input;
  return callApi<ApMutationResult, Omit<ApPaymentSentInput, 'apId'>>(
    `/v1/ap/${encodeURIComponent(apId)}/payment-sent`,
    body,
    mutationOptions('ap-payment-sent', apId),
  );
}

export function apPaymentReceivedViaApi(input: ApPaymentReceivedInput) {
  const { apId, ...body } = input;
  return callApi<ApMutationResult, Omit<ApPaymentReceivedInput, 'apId'>>(
    `/v1/ap/${encodeURIComponent(apId)}/payment-received`,
    body,
    mutationOptions('ap-payment-received', apId),
  );
}
