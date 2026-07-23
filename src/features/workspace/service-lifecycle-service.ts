import { callFunction } from '@/lib/firebase/call-function';

export async function requestServiceCancellation(serviceId: string) {
  return callFunction<
    { ok: true; status: 'cancelled' | 'cancellation_requested' },
    { serviceId: string }
  >('requestServiceCancellation', { serviceId });
}

export async function respondServiceCancellation(
  serviceId: string,
  action: 'accepted' | 'rejected',
) {
  return callFunction<
    { ok: true; status: 'cancelled' | 'in_progress' },
    { serviceId: string; action: 'accepted' | 'rejected' }
  >('respondServiceCancellation', { serviceId, action });
}
