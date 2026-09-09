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
import {
  setLoadingBridge,
  type LoadingApi,
  type WithLoadingOptions,
} from "@/providers/loading-bridge";

const LoadingContext = createContext<LoadingApi | null>(null);

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
    setLoadingBridge(api);
    return () => {
      setLoadingBridge(null);
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
