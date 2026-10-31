import { useEffect, useEffectEvent, useRef, useState } from 'react';

/**
 * Read a scanned document on device as soon as its image is set, and hand the
 * result to `onRead`. Re-reads when the image changes; never re-reads the same
 * file. Failures are swallowed — the form stays usable by hand.
 */
export function useDocumentReader<T>(
  uri: string | null | undefined,
  read: (uri: string) => Promise<T | null>,
  onRead: (result: T | null) => void,
): { reading: boolean } {
  const [reading, setReading] = useState(false);
  const lastUri = useRef<string | null>(null);
  const deliver = useEffectEvent(onRead);
  const run = useEffectEvent(read);

  useEffect(() => {
    if (!uri || uri === lastUri.current) return;
    lastUri.current = uri;
    let cancelled = false;
    setReading(true);
    run(uri)
      .catch((e: unknown) => {
        if (__DEV__) console.warn('Document reading failed', e);
        return null;
      })
      .then((result) => {
        if (!cancelled) deliver(result);
      })
      .finally(() => {
        if (!cancelled) setReading(false);
      });
    return () => {
      cancelled = true;
      // Let a remount with the same image try again.
      lastUri.current = null;
    };
  }, [uri]);

  return { reading };
}

/**
 * Tracks which form fields were filled from a scan, so a later scan may
 * replace them but never overwrites what the user typed.
 */
export function useAutofillGuard<K extends string>(defaults: Partial<Record<K, string>> = {}) {
  const filled = useRef<Partial<Record<K, string>>>(defaults);
  return {
    /** True when `current` is empty or still the value a scan (or default) put there. */
    canFill: (field: K, current: string | null | undefined) =>
      !current || current === filled.current[field],
    mark: (field: K, value: string) => {
      filled.current[field] = value;
    },
  };
}
