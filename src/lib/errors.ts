/**
 * Converts any thrown error into a short, non-technical message safe to show
 * in a toast (1–2 lines max). Technical details (Firestore index links, stack
 * traces, Firebase error codes) never reach the user.
 */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : '';
  const hay = `${code} ${message}`.toLowerCase();
  const normalizedCode = code.toLowerCase();

  // Provider SDKs can expose low-level sign-in results. Keep those details
  // out of the app and give the user a clear next step instead.
  const isGoogleSignIn = hay.includes('google sign-in') || hay.includes('google signin');
  const isAppleSignIn = hay.includes('apple sign-in') || hay.includes('apple signin');
  if (isGoogleSignIn && (hay.includes('cancel') || hay.includes('id token'))) {
    return 'Google sign-in was cancelled. Try again or choose another sign-in method.';
  }
  if (isAppleSignIn && (hay.includes('cancel') || hay.includes('identity token'))) {
    return 'Apple sign-in was cancelled. Try again or choose another sign-in method.';
  }
  if (
    normalizedCode === 'auth/popup-closed-by-user' ||
    normalizedCode === 'auth/cancelled-popup-request' ||
    normalizedCode === 'auth/canceled' ||
    normalizedCode === 'auth/cancelled'
  ) {
    return 'Sign-in was cancelled. Try again when you are ready.';
  }
  if (normalizedCode === 'auth/popup-blocked') {
    return 'Sign-in could not open. Try again.';
  }
  if (
    normalizedCode === 'err_request_canceled' ||
    normalizedCode === 'err_request_cancelled' ||
    normalizedCode === 'err_canceled' ||
    normalizedCode === 'err_cancelled'
  ) {
    return 'That action was cancelled. You can try again when you are ready.';
  }

  // Firestore index missing or still building. Other failed-precondition
  // responses are intentional domain errors from the API and should keep
  // their safe, actionable message.
  if (
    code === 'failed-precondition' &&
    (hay.includes('requires an index') || hay.includes('needs an index'))
  ) {
    return 'Still getting things ready. Please try again in a moment.';
  }

  if (code === 'failed-precondition') {
    if (hay.includes('exchange rate') || hay.includes('currency conversion')) {
      return 'Currency conversion is temporarily unavailable. Please try again later.';
    }
    const domainMessage = safeUserMessage(message, '');
    if (domainMessage) return domainMessage;
  }

  // Permissions / access.
  if (code === 'permission-denied' || hay.includes('permission-denied') || hay.includes('insufficient permissions')) {
    return "You don't have access to do that.";
  }

  // Connectivity.
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'auth/network-request-failed' ||
    hay.includes('network') ||
    hay.includes('offline') ||
    (hay.includes('unavailable') && !hay.includes('app-check')) ||
    hay.includes('timeout')
  ) {
    return 'Connection problem. Check your internet and try again.';
  }

  // Rate limiting.
  if (code === 'resource-exhausted' || code === 'auth/too-many-requests' || hay.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // App Check protects the API after Firebase Auth succeeds. Surface this
  // separately so a missing or rejected native token is not misreported as
  // an invalid OTP.
  if (
    code === 'app-check/unavailable' ||
    hay.includes('app check') ||
    hay.includes('integrity')
  ) {
    return 'This app could not be verified for secure sign-in. Update and try again.';
  }

  // Authentication.
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') return 'That email is already registered.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/weak-password') return 'Please choose a stronger password.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  if (code === 'auth/user-token-expired' || code === 'auth/invalid-user-token') {
    return 'Your session expired. Please sign in again.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'For security, enter your password again and try once more.';
  }
  if (code === 'auth/credential-already-in-use') {
    return 'That phone number is already linked to another account.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with another sign-in method. Try that method instead.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method is not available right now. Try another way.';
  }
  if (code === 'auth/provider-already-linked' || hay.includes('already been linked to the given provider')) {
    return 'A phone number is already linked to this account.';
  }
  if (code === 'auth/invalid-verification-code' || code === 'auth/invalid-verification-id') {
    return 'That code is incorrect. Please try again.';
  }
  if (code === 'auth/code-expired') return 'That code has expired. Please request a new one.';

  // Common Firestore/API responses should describe the outcome, not the
  // backend terminology that produced it.
  if (code === 'unauthenticated') return 'Sign in to continue.';
  if (code === 'not-found') return 'We could not find that. It may have been removed.';
  if (code === 'invalid-argument') return 'Check the information and try again.';
  if (code === 'already-exists') return 'That already exists.';
  if (code === 'aborted') return 'That change could not be saved. Please try again.';
  if (code === 'out-of-range') return 'Check the information and try again.';

  // API errors have an internal code for logging, but their message may still
  // be a safe, actionable response from the server.
  if (code.startsWith('api/')) {
    const apiMessage = safeUserMessage(message, '');
    if (apiMessage) return apiMessage;
  }

  // A short, intentionally user-facing message thrown by our own code
  // (e.g. "Your account has been suspended.") — keep it. Otherwise fall back so
  // raw SDK strings never surface.
  const looksTechnical =
    !message ||
    message.length > 90 ||
    isTechnicalMessage(message) ||
    code.length > 0;
  if (!looksTechnical) return message;

  return fallback;
}

/** Ensures strings received by a UI component cannot reveal implementation details. */
export function safeUserMessage(message: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof message !== 'string') return fallback;

  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 140 || isTechnicalMessage(trimmed)) return fallback;

  return trimmed;
}

function isTechnicalMessage(value: string): boolean {
  const normalized = value.toLowerCase();
  const hasBackendValidationIdentifier =
    /\b[a-z][A-Za-z0-9_]*(?:[A-Z][A-Za-z0-9_]*|_[a-z0-9_]+)+\b\s+(?:must be|required|is required|is invalid|is missing|is not valid|was expected)\b/i.test(
      value,
    );

  return (
    normalized.includes('firebase') ||
    normalized.includes('firestore') ||
    normalized.includes('storage/') ||
    normalized.includes('auth/') ||
    normalized.includes('functions/') ||
    normalized.includes('http') ||
    normalized.includes('stack') ||
    normalized.includes('exception') ||
    normalized.includes('internal error') ||
    normalized.includes('unexpected response') ||
    normalized.includes('invalid response') ||
    normalized.includes('id token') ||
    normalized.includes('identity token') ||
    normalized.includes('credential') ||
    normalized.includes('apid') ||
    normalized.includes('gemid') ||
    normalized.includes('serviceid') ||
    normalized.includes('paymentduedate') ||
    normalized.includes('ownerreceives') ||
    normalized.includes('receiverkeeps') ||
    normalized.includes('soldprice') ||
    normalized.includes('paymentmethod') ||
    normalized.includes('request body') ||
    normalized.includes('request id') ||
    normalized.includes('api route') ||
    normalized.includes('endpoint') ||
    normalized.includes('payload') ||
    normalized.includes('validation error') ||
    normalized.includes('invalid field') ||
    normalized.includes('unknown field') ||
    normalized.includes('target user') ||
    normalized.includes('must be used within') ||
    normalized.includes('missing exchange rate') ||
    normalized.includes('exchange rate for') ||
    normalized.includes('reconciliation') ||
    normalized.includes('inconsistent') ||
    normalized.includes('upload-timeout') ||
    normalized.includes('env var') ||
    normalized.includes('expo_public') ||
    normalized.includes('undefined') ||
    normalized.includes('null') ||
    normalized.includes('permission-denied') ||
    normalized.includes('failed-precondition') ||
    hasBackendValidationIdentifier
  );
}
