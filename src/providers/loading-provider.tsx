import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { LoadingOverlay } from "@/components/ui/loading-overlay";

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

type LoadingApi = {
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

const LoadingContext = createContext<LoadingApi | null>(null);

/** Module bridge so services / non-hook call sites work after mount. */
let bridge: LoadingApi | null = null;

const DEFAULT_MESSAGE = "Please wait…";

function resolveOptions(
  messageOrOptions?: string | WithLoadingOptions,
): Required<WithLoadingOptions> {
  if (typeof messageOrOptions === "string") {
    return { message: messageOrOptions, overlay: true };
  }
  return {
    message: messageOrOptions?.message ?? DEFAULT_MESSAGE,
    overlay: messageOrOptions?.overlay ?? true,
  };
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);
  const [overlayDepth, setOverlayDepth] = useState(0);
  const [message, setMessageState] = useState(DEFAULT_MESSAGE);
  const depthRef = useRef(0);
  const overlayDepthRef = useRef(0);

  const show = useCallback((nextMessage?: string) => {
    depthRef.current += 1;
    overlayDepthRef.current += 1;
    setDepth(depthRef.current);
    setOverlayDepth(overlayDepthRef.current);
    if (nextMessage) setMessageState(nextMessage);
    else if (depthRef.current === 1) setMessageState(DEFAULT_MESSAGE);
  }, []);

  const hide = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    overlayDepthRef.current = Math.max(0, overlayDepthRef.current - 1);
    setDepth(depthRef.current);
    setOverlayDepth(overlayDepthRef.current);
    if (depthRef.current === 0) setMessageState(DEFAULT_MESSAGE);
  }, []);

  const setMessage = useCallback((next: string) => {
    setMessageState(next || DEFAULT_MESSAGE);
  }, []);

  const withLoading = useCallback(
    async <T,>(
      task: () => Promise<T>,
      messageOrOptions?: string | WithLoadingOptions,
    ): Promise<T> => {
      const opts = resolveOptions(messageOrOptions);
      depthRef.current += 1;
      setDepth(depthRef.current);
      if (opts.overlay) {
        overlayDepthRef.current += 1;
        setOverlayDepth(overlayDepthRef.current);
      }
      setMessageState(opts.message);
      try {
        return await task();
      } finally {
        depthRef.current = Math.max(0, depthRef.current - 1);
        setDepth(depthRef.current);
        if (opts.overlay) {
          overlayDepthRef.current = Math.max(0, overlayDepthRef.current - 1);
          setOverlayDepth(overlayDepthRef.current);
        }
        if (depthRef.current === 0) setMessageState(DEFAULT_MESSAGE);
      }
    },
    [],
  );

  const api = useMemo<LoadingApi>(
    () => ({
      isBusy: depth > 0,
      message,
      show,
      hide,
      setMessage,
      withLoading,
    }),
    [depth, message, show, hide, setMessage, withLoading],
  );

  useEffect(() => {
    bridge = api;
    return () => {
      if (bridge === api) bridge = null;
    };
  }, [api]);

  return (
    <LoadingContext.Provider value={api}>
      {children}
      <LoadingOverlay
        visible={overlayDepth > 0}
        message={message}
      />
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return ctx;
}

/** Soft busy flag — safe outside provider (returns false). */
export function useIsBusy(): boolean {
  const ctx = useContext(LoadingContext);
  return ctx?.isBusy ?? false;
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
  if (!bridge) {
    return;
  }
  bridge.show(message);
}

export function hideLoading(): void {
  if (!bridge) return;
  bridge.hide();
}

/** Update overlay copy while a nested upload / write is running. */
export function setLoadingMessage(message: string): void {
  if (!bridge) return;
  bridge.setMessage(message);
}
