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

import {
  ActionSheet,
  type ActionSheetItem,
} from "@/components/ui/action-sheet";
import {
  ConfirmDialog,
  type ConfirmTone,
} from "@/components/ui/confirm-dialog";
import type { IconName } from "@/components/ui/icon";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: IconName;
  /**
   * Runs when the user confirms. Dialog shows a loading state while awaiting.
   * Throw (or reject) to keep the dialog open after failure.
   */
  onConfirm?: () => void | Promise<void>;
};

export type ShowActionsOptions = {
  title?: string;
  message?: string;
  cancelLabel?: string;
  actions: ActionSheetItem[];
};

type ConfirmApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showActions: (options: ShowActionsOptions) => void;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PendingActions = ShowActionsOptions & {
  id: number;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

/** Module bridge so non-hook call sites work after mount. */
let bridge: ConfirmApi | null = null;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<PendingActions | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;
  const actionsSeq = useRef(0);

  const close = useCallback((result: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
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
      setPending({ ...options, resolve });
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
    bridge = api;
    return () => {
      if (bridge === api) bridge = null;
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
      await current.onConfirm();
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

/**
 * Imperative confirm — works from any module once ConfirmProvider is mounted.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!bridge) {
    console.warn("ConfirmProvider is not mounted; confirm() ignored.");
    return Promise.resolve(false);
  }
  return bridge.confirm(options);
}

/** Themed multi-action sheet (replaces native Alert menus). */
export function showActions(options: ShowActionsOptions): void {
  if (!bridge) {
    console.warn("ConfirmProvider is not mounted; showActions() ignored.");
    return;
  }
  bridge.showActions(options);
}

/** Destructive delete confirm with loading-aware confirm button. */
export function confirmDelete(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
): Promise<boolean> {
  return confirm({
    title,
    message,
    tone: "destructive",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    icon: "delete-outline",
    onConfirm,
  });
}
