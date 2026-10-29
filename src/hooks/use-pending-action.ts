import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Local loading state for one async action (save, delete, sign in…).
 *
 * Wraps `action` so the returned `run` flips `pending` while it is in flight
 * and ignores repeat taps until it settles. Pass `pending` to the button or
 * row that triggered it: `<Button loading={pending} onPress={run} />`.
 */
export function usePendingAction<Args extends unknown[], R>(
  action: (...args: Args) => Promise<R>,
): [pending: boolean, run: (...args: Args) => Promise<R | undefined>] {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const actionRef = useRef(action);

  // Latest closure for `run`, so callers can pass an inline action.
  useLayoutEffect(() => {
    actionRef.current = action;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: Args) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await actionRef.current(...args);
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return [pending, run];
}
