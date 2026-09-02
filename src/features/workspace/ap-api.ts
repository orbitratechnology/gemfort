import { callApi } from '@/lib/api/api-client';
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

function idempotencyKey(operation: string, scope = 'request'): string {
  const safeScope = scope.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 72);
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `mobile-${operation}-${safeScope || 'request'}-${nonce}`.slice(0, 128);
}

function mutationOptions(operation: string, scope?: string) {
  return {
    retryAuthOn401: true,
    idempotencyKey: idempotencyKey(operation, scope),
  } as const;
}

export function createApRequestViaApi(input: {
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays: number;
  agreementNotes?: string | null;
  items: { gemId: string; agreedPrice: number; currency?: string }[];
}) {
  return callApi<{ apId: string }, typeof input>(
    '/v1/ap/requests',
    input,
    mutationOptions('ap-create'),
  ).then(({ apId }) => apId);
}

export function respondApRequestViaApi(
  apId: string,
  action: 'accepted' | 'rejected',
  rejectionReason?: string,
) {
  return callApi<ApMutationResult, { action: typeof action; rejectionReason?: string }>(
    `/v1/ap/requests/${encodeURIComponent(apId)}/respond`,
    rejectionReason ? { action, rejectionReason } : { action },
    mutationOptions(`ap-respond-${action}`, apId),
  );
}

export function cancelApRequestViaApi(apId: string) {
  return callApi<ApMutationResult, Record<string, never>>(
    `/v1/ap/requests/${encodeURIComponent(apId)}/cancel`,
    {},
    mutationOptions('ap-cancel-request', apId),
  );
}

export function returnApGemViaApi(apId: string, gemId: string) {
  return callApi<ApMutationResult, { gemId: string }>(
    `/v1/ap/${encodeURIComponent(apId)}/return`,
    { gemId },
    mutationOptions('ap-return', apId),
  );
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

export function deleteApRecordViaApi(apId: string) {
  return callApi<ApMutationResult, undefined>(
    `/v1/ap/records/${encodeURIComponent(apId)}`,
    undefined,
    { ...mutationOptions('ap-delete', apId), method: 'DELETE' },
  );
}
