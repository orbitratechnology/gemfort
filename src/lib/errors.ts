/**
 * Converts any thrown error into a short, non-technical message safe to show
 * in a toast (1–2 lines max). The raw error is always logged to the console for
 * debugging — technical details (Firestore index links, stack traces, Firebase
 * error codes) never reach the user.
 */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  // Always log the real error so developers can diagnose (incl. index links).
  console.error('[GemFort]', error);

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : '';
  const hay = `${code} ${message}`.toLowerCase();

  // Firestore index missing or still building.
  if (code === 'failed-precondition' || hay.includes('requires an index') || hay.includes('needs an index')) {
    return 'Still getting things ready. Please try again in a moment.';
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
    hay.includes('unavailable') ||
    hay.includes('timeout')
  ) {
    return 'Connection problem. Check your internet and try again.';
  }

  // Rate limiting.
  if (code === 'resource-exhausted' || code === 'auth/too-many-requests' || hay.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
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
  if (code === 'auth/requires-recent-login') {
    return 'For security, enter your password again and try once more.';
  }
  if (code === 'auth/invalid-verification-code' || code === 'auth/invalid-verification-id') {
    return 'That code is incorrect. Please try again.';
  }
  if (code === 'auth/code-expired') return 'That code has expired. Please request a new one.';

  // A short, intentionally user-facing message thrown by our own code
  // (e.g. "Your account has been suspended.") — keep it. Otherwise fall back so
  // raw SDK strings never surface.
  const looksTechnical =
    !message ||
    message.length > 90 ||
    hay.includes('firebase') ||
    hay.includes('firestore') ||
    hay.includes('http') ||
    code.length > 0;
  if (!looksTechnical) return message;

  return fallback;
}
