import {
    canListGem,
    gemMatchesStatusFilter,
    isTerminalOutcome,
    resolveGemLifecycle,
} from "@/features/workspace/gem-lifecycle";
import type { GemStatus, WorkspaceGem } from "@/types";

export type GemListFilters = {
  search?: string;
  status?: GemStatus | "all";
  gemType?: string | "all";
  /** When true, only sold/returned. When false/omitted, hide sold/returned. */
  archiveOnly?: boolean;
};

export function filterGems(
  gems: WorkspaceGem[],
  filters: GemListFilters,
): WorkspaceGem[] {
  let result = gems;
  const term = filters.search?.trim().toLowerCase();

  if (term) {
    result = result.filter(
      (g) =>
        g.title?.toLowerCase().includes(term) ||
        g.sku.toLowerCase().includes(term) ||
        g.gemType.toLowerCase().includes(term) ||
        g.originCountry.toLowerCase().includes(term) ||
        g.notes?.toLowerCase().includes(term),
    );
  }

  if (filters.archiveOnly) {
    result = result.filter((g) =>
      isTerminalOutcome(resolveGemLifecycle(g).outcome),
    );
  } else {
    result = result.filter(
      (g) => !isTerminalOutcome(resolveGemLifecycle(g).outcome),
    );
  }

  if (filters.status && filters.status !== "all") {
    result = result.filter((g) => gemMatchesStatusFilter(g, filters.status!));
  }

  if (filters.gemType && filters.gemType !== "all") {
    result = result.filter((g) => g.gemType === filters.gemType);
  }

  return result;
}

export type GemQuickAction = {
  title: string;
  href: string;
  variant?: "primary" | "secondary";
};

export function getGemQuickActions(gem: WorkspaceGem): GemQuickAction[] {
  const base = "/(marketplace)/(tabs)/workspace";
  const actions: GemQuickAction[] = [];
  const life = resolveGemLifecycle(gem);

  if (life.stoneStage === "rough") {
    actions.push({
      title: "Record Cutting",
      href: `/(marketplace)/services/add?gemId=${gem.id}`,
    });
  } else if (!life.custody) {
    actions.push({
      title: "Give on AP",
      href: `/(marketplace)/ap/add?gemId=${gem.id}`,
    });
  }

  if (life.custody === "on_ap") {
    actions.push({
      title: "View AP Records",
      href: `${base}/ap`,
      variant: "secondary",
    });
  }

  if (canListGem(gem)) {
    actions.push({
      title: "Sell on Market",
      href: `/listings/create?workspaceGemId=${gem.id}`,
      variant: actions.length ? "secondary" : "primary",
    });
  }

  if (
    gem.isListedOnMarketplace &&
    gem.marketplaceListingId &&
    !isTerminalOutcome(life.outcome)
  ) {
    actions.push({
      title: "View on Market",
      href: `/listing/${gem.marketplaceListingId}`,
      variant: "secondary",
    });
  }

  if (life.stoneStage !== "rough") {
    actions.push({
      title: "Record Service",
      href: `/(marketplace)/services/add?gemId=${gem.id}`,
      variant: "secondary",
    });
  }

  return actions;
}
