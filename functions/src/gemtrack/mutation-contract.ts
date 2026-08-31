export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type MutationDecision =
  | { kind: 'transition'; status: string }
  | { kind: 'replay'; status: string }
  | { kind: 'reject'; code: 'permission-denied' | 'failed-precondition'; message: string };

export type ServiceCancellationRequestFixture = {
  ownerUid: string;
  providerUid?: string | null;
  status: string;
};

export type ServiceCancellationResponseFixture = {
  providerUid: string | null | undefined;
  status: string;
};

export type ApMutationFixture = {
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  status: string;
};

export function validateIdempotencyKey(value: string | undefined): string {
  const key = value?.trim() ?? '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new Error(
      `Idempotency-Key must be 1-${IDEMPOTENCY_KEY_MAX_LENGTH} characters and use only letters, numbers, ., _, :, or -.`,
    );
  }
  return key;
}

export function canActOnAp(
  action: 'create' | 'respond' | 'cancel' | 'sale' | 'return' | 'payment-sent' |
    'payment-received' | 'request-cancellation' | 'respond-cancellation' | 'delete',
  ap: ApMutationFixture,
  uid: string,
): boolean {
  switch (action) {
    case 'create':
      return uid === ap.senderUid && uid === ap.ownerUid;
    case 'respond':
    case 'sale':
    case 'payment-sent':
    case 'respond-cancellation':
      return uid === ap.receiverUid;
    case 'payment-received':
      return uid === ap.senderUid || uid === ap.ownerUid;
    case 'cancel':
    case 'request-cancellation':
      return uid === ap.senderUid || uid === ap.ownerUid;
    case 'return':
    case 'delete':
      return uid === ap.senderUid || uid === ap.ownerUid || uid === ap.receiverUid;
  }
}

export function decideServiceCancellationRequest(
  service: ServiceCancellationRequestFixture,
  uid: string,
): MutationDecision {
  if (service.ownerUid !== uid) {
    return {
      kind: 'reject',
      code: 'permission-denied',
      message: 'Only the owner can request cancellation.',
    };
  }

  if (service.status === 'given' || service.status === 'in_progress' || service.status === 'overdue') {
    return {
      kind: 'transition',
      status: service.providerUid?.trim() ? 'cancellation_requested' : 'cancelled',
    };
  }

  if (service.status === 'cancellation_requested' || service.status === 'cancelled') {
    return { kind: 'replay', status: service.status };
  }

  return {
    kind: 'reject',
    code: 'failed-precondition',
    message: 'This service is not active.',
  };
}

export function decideServiceCancellationResponse(
  service: ServiceCancellationResponseFixture,
  uid: string,
  action: 'accepted' | 'rejected',
): MutationDecision {
  if (service.providerUid !== uid) {
    return {
      kind: 'reject',
      code: 'permission-denied',
      message: 'Only the provider can respond.',
    };
  }

  if (service.status === 'cancellation_requested') {
    return { kind: 'transition', status: action === 'accepted' ? 'cancelled' : 'in_progress' };
  }

  if ((action === 'accepted' && service.status === 'cancelled') ||
      (action === 'rejected' && service.status === 'in_progress')) {
    return { kind: 'replay', status: service.status };
  }

  return {
    kind: 'reject',
    code: 'failed-precondition',
    message: 'No cancellation request pending.',
  };
}

export function decideApStatusTransition(
  action: 'respond-accepted' | 'respond-rejected' | 'cancel' | 'request-cancellation' |
    'respond-cancellation-accepted' | 'respond-cancellation-rejected',
  status: string,
): MutationDecision {
  switch (action) {
    case 'respond-accepted':
      if (status === 'pending') return { kind: 'transition', status: 'accepted' };
      if (status === 'accepted') return { kind: 'replay', status };
      return { kind: 'reject', code: 'failed-precondition', message: 'This AP is no longer pending.' };
    case 'respond-rejected':
      if (status === 'pending') return { kind: 'transition', status: 'rejected' };
      if (status === 'rejected') return { kind: 'replay', status };
      return { kind: 'reject', code: 'failed-precondition', message: 'This AP is no longer pending.' };
    case 'cancel':
      if (status === 'pending') return { kind: 'transition', status: 'cancelled' };
      if (status === 'cancelled') return { kind: 'replay', status };
      return { kind: 'reject', code: 'failed-precondition', message: 'Only pending APs can be cancelled.' };
    case 'request-cancellation':
      if (new Set(['accepted', 'with_holder', 'payment_sent', 'sold', 'overdue', 'disputed']).has(status)) {
        return { kind: 'transition', status: 'cancellation_requested' };
      }
      if (status === 'cancellation_requested') return { kind: 'replay', status };
      return {
        kind: 'reject',
        code: 'failed-precondition',
        message: 'This AP cannot request cancellation in its current status.',
      };
    case 'respond-cancellation-accepted':
      if (status === 'cancellation_requested') return { kind: 'transition', status: 'cancelled' };
      if (status === 'cancelled') return { kind: 'replay', status };
      return { kind: 'reject', code: 'failed-precondition', message: 'No cancellation request pending.' };
    case 'respond-cancellation-rejected':
      if (status === 'cancellation_requested') return { kind: 'transition', status: 'accepted' };
      if (status === 'accepted') return { kind: 'replay', status };
      return { kind: 'reject', code: 'failed-precondition', message: 'No cancellation request pending.' };
  }
}
