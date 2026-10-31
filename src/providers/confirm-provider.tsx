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

import { ActionSheet } from "@/components/ui/action-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  setConfirmBridge,
  type ConfirmApi,
  type ConfirmOptions,
  type ShowActionsOptions,
} from "@/providers/confirm-bridge";

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PendingActions = ShowActionsOptions & {
  id: number;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<PendingActions | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const actionsSeq = useRef(0);

  const close = useCallback((result: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setLoading(false);
    setPending(null);
    current.resolve(result);
  }, []);

  const confirmFn = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
      }
      setLoading(false);
      const next = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const showActionsFn = useCallback((options: ShowActionsOptions) => {
    actionsSeq.current += 1;
    setActions({ ...options, id: actionsSeq.current });
  }, []);

  const api = useMemo(
    () => ({ confirm: confirmFn, showActions: showActionsFn }),
    [confirmFn, showActionsFn],
  );

  useEffect(() => {
    setConfirmBridge(api);
    return () => {
      setConfirmBridge(null);
    };
  }, [api]);

  async function handleConfirm() {
    const current = pendingRef.current;
    if (!current || loading) return;

    if (!current.onConfirm) {
      close(true);
      return;
    }

    setLoading(true);
    try {
      await current.onConfirm!();
      close(true);
    } catch {
      setLoading(false);
    }
  }

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <ConfirmDialog
        visible={!!pending}
        title={pending?.title ?? ""}
        message={pending?.message}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        tone={pending?.tone}
        icon={pending?.icon}
        loading={loading}
        onCancel={() => close(false)}
        onConfirm={() => {
          void handleConfirm();
        }}
      />
      <ActionSheet
        visible={!!actions}
        title={actions?.title}
        message={actions?.message}
        actions={actions?.actions ?? []}
        cancelLabel={actions?.cancelLabel}
        onClose={() => setActions(null)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
