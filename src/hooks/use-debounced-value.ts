import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs` after the last change.
 * Use for search filters and link/favicon preview so typing stays snappy.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
