import { callApi } from '@/lib/api/api-client';

export async function requestServiceCancellation(serviceId: string) {
  return callApi<
    { ok: true; status: 'cancelled' | 'cancellation_requested' },
    Record<string, never>
  >(`/v1/services/${encodeURIComponent(serviceId)}/cancellation`, {}, {
    retryAuthOn401: true,
    idempotencyKey: `mobile-service-cancel-${encodeURIComponent(serviceId)}-${Date.now().toString(36)}`.slice(0, 128),
  });
}

export async function respondServiceCancellation(
  serviceId: string,
  action: 'accepted' | 'rejected',
) {
  return callApi<
    { ok: true; status: 'cancelled' | 'in_progress' },
    { action: 'accepted' | 'rejected' }
  >(`/v1/services/${encodeURIComponent(serviceId)}/cancellation/respond`, { action }, {
    retryAuthOn401: true,
    idempotencyKey: `mobile-service-cancel-${action}-${encodeURIComponent(serviceId)}-${Date.now().toString(36)}`.slice(0, 128),
  });
}
