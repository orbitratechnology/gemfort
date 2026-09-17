export type WithLoadingOptions = {
  /** Status copy shown on the blocking overlay. */
  message?: string;
  /**
   * When false, only flips the global busy flag (disables buttons)
   * without showing the full-screen overlay. Use inside ConfirmDialog
   * flows that already have their own spinner.
   */
  overlay?: boolean;
};

export type LoadingApi = {
  /** True while any tracked mutation is in flight. */
  isBusy: boolean;
  /** Current overlay message (empty when idle). */
  message: string;
  show: (message?: string) => void;
  hide: () => void;
  setMessage: (message: string) => void;
  withLoading: <T>(
    task: () => Promise<T>,
    messageOrOptions?: string | WithLoadingOptions,
  ) => Promise<T>;
};

let bridge: LoadingApi | null = null;

export function setLoadingBridge(next: LoadingApi | null): void {
  bridge = next;
}

/**
 * Imperative helper — works from any module once LoadingProvider is mounted.
 * Prefer this (or `useLoading().withLoading`) around Firebase writes / uploads.
 */
export async function withLoading<T>(
  task: () => Promise<T>,
  messageOrOptions?: string | WithLoadingOptions,
): Promise<T> {
  if (!bridge) {
    return task();
  }
  return bridge.withLoading(task, messageOrOptions);
}

export function showLoading(message?: string): void {
  bridge?.show(message);
}

export function hideLoading(): void {
  bridge?.hide();
}

/** Update overlay copy while a nested upload / write is running. */
export function setLoadingMessage(message: string): void {
  bridge?.setMessage(message);
}
