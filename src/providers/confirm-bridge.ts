import type { ActionSheetItem } from "@/components/ui/action-sheet";
import type { ConfirmTone } from "@/components/ui/confirm-dialog";
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

export type ConfirmApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showActions: (options: ShowActionsOptions) => void;
};

let bridge: ConfirmApi | null = null;

export function setConfirmBridge(next: ConfirmApi | null): void {
  bridge = next;
}

/** Imperative confirm — works from any module once ConfirmProvider is mounted. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!bridge) {
    return Promise.resolve(false);
  }
  return bridge.confirm(options);
}

/** Themed multi-action sheet (replaces native Alert menus). */
export function showActions(options: ShowActionsOptions): void {
  bridge?.showActions(options);
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
