import type { GemStatus, WorkspaceGem } from "@/types";

export type GemListFilters = {
  search?: string;
  status?: GemStatus | "all";
  gemType?: string | "all";
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
        g.sku.toLowerCase().includes(term) ||
        g.gemType.toLowerCase().includes(term) ||
        g.originCountry.toLowerCase().includes(term) ||
        g.notes?.toLowerCase().includes(term),
    );
  }

  if (filters.status && filters.status !== "all") {
    result = result.filter((g) => g.status === filters.status);
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

  switch (gem.status) {
    case "rough":
      actions.push({
        title: "Record Cutting",
        href: `${base}/services/add?gemId=${gem.id}`,
      });
      break;
    case "cut":
    case "heated":
    case "polished":
    case "certified":
    case "ready_for_sale":
      actions.push({
        title: "Give on AP",
        href: `${base}/ap/add?gemId=${gem.id}`,
      });
      break;
    case "on_ap":
      actions.push({
        title: "View AP Records",
        href: `${base}/ap`,
        variant: "secondary",
      });
      break;
    default:
      break;
  }

  if (
    (gem.status === "ready_for_sale" || gem.status === "certified") &&
    !gem.isListedOnMarketplace
  ) {
    actions.push({
      title: "List on GemNet",
      href: `/listings/create?workspaceGemId=${gem.id}`,
      variant: actions.length ? "secondary" : "primary",
    });
  }

  if (gem.isListedOnMarketplace && gem.marketplaceListingId) {
    actions.push({
      title: "View GemNet Listing",
      href: `/listing/${gem.marketplaceListingId}`,
      variant: "secondary",
    });
  }

  if (gem.status !== "rough") {
    actions.push({
      title: "Record Service",
      href: `${base}/services/add?gemId=${gem.id}`,
      variant: "secondary",
    });
  }

  return actions;
}
