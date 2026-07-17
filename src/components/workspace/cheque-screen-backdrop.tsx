import { WorkspaceScreenBackdrop } from '@/components/workspace/workspace-screen-backdrop';

/** Centered cheque-purpose backdrop (paper slip + money-check watermarks). */
export function ChequeScreenBackdrop() {
  return <WorkspaceScreenBackdrop kind="cheques" />;
}
