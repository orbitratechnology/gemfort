import type {
  GemCustody,
  GemOutcome,
  GemStatus,
  GemStoneStage,
  WorkspaceGem,
} from "@/types";
import { formatGemStatusLabel } from "@/constants/gem-options";

const STONE_STAGES: readonly GemStoneStage[] = [
  "rough",
  "cut",
  "heated",
  "polished",
];

const CUSTODIES: readonly GemCustody[] = [
  "with_cutter",
  "with_heater",
  "with_polisher",
  "on_ap",
  "on_trip",
];

const OUTCOMES: readonly GemOutcome[] = ["listed", "sold", "returned"];

export function isGemStoneStage(value: string): value is GemStoneStage {
  return (STONE_STAGES as readonly string[]).includes(value);
}

export function isGemCustody(value: string): value is GemCustody {
  return (CUSTODIES as readonly string[]).includes(value);
}

export function isGemOutcome(value: string): value is GemOutcome {
  return (OUTCOMES as readonly string[]).includes(value);
}

/** Sold / returned are terminal — never listable. */
export function isTerminalOutcome(
  outcome: GemOutcome | null | undefined,
): boolean {
  return outcome === "sold" || outcome === "returned";
}

export type GemLifecycle = {
  stoneStage: GemStoneStage;
  custody: GemCustody | null;
  outcome: GemOutcome | null;
};

/** Derive three independent axes from new fields or legacy single `status`. */
export function resolveGemLifecycle(
  gem: Pick<
    WorkspaceGem,
    "status" | "stoneStage" | "custody" | "outcome" | "isListedOnMarketplace"
  >,
): GemLifecycle {
  const legacy = gem.status;

  let stoneStage: GemStoneStage =
    gem.stoneStage && isGemStoneStage(gem.stoneStage)
      ? gem.stoneStage
      : isGemStoneStage(legacy)
        ? legacy
        : legacy === "certified" || legacy === "ready_for_sale"
          ? "polished"
          : "rough";

  let custody: GemCustody | null =
    gem.custody === undefined
      ? isGemCustody(legacy)
        ? legacy
        : null
      : gem.custody && isGemCustody(gem.custody)
        ? gem.custody
        : null;

  let outcome: GemOutcome | null =
    gem.outcome != null && isGemOutcome(gem.outcome)
      ? gem.outcome
      : isGemOutcome(legacy)
        ? legacy
        : null;

  if (
    gem.stoneStage == null &&
    gem.custody == null &&
    gem.outcome == null &&
    isGemCustody(legacy)
  ) {
    // Legacy custody-only docs: keep a sensible stone default.
    stoneStage = "cut";
  }

  // Terminal outcomes always win over a stale marketplace flag.
  if (!isTerminalOutcome(outcome) && gem.isListedOnMarketplace) {
    outcome = "listed";
  }

  return { stoneStage, custody, outcome };
}

/**
 * Legacy single `status` for older call sites.
 * Priority: sold > returned > custody > listed > stone.
 */
export function derivePrimaryStatus(lifecycle: GemLifecycle): GemStatus {
  if (lifecycle.outcome === "sold") return "sold";
  if (lifecycle.outcome === "returned") return "returned";
  if (lifecycle.custody) return lifecycle.custody;
  if (lifecycle.outcome === "listed") return "listed";
  return lifecycle.stoneStage;
}

/** Apply a single-axis change without clearing the other axes. */
export function applyLifecyclePatch(
  current: GemLifecycle,
  patch: {
    stoneStage?: GemStoneStage;
    custody?: GemCustody | null;
    outcome?: GemOutcome | null;
  },
): GemLifecycle {
  const next: GemLifecycle = {
    stoneStage: patch.stoneStage ?? current.stoneStage,
    custody: patch.custody !== undefined ? patch.custody : current.custody,
    outcome: patch.outcome !== undefined ? patch.outcome : current.outcome,
  };

  // Sold / returned replace "listed" — they cannot coexist.
  if (isTerminalOutcome(next.outcome) && patch.outcome !== undefined) {
    // outcome already set to sold/returned
  } else if (
    patch.outcome === "listed" &&
    isTerminalOutcome(current.outcome)
  ) {
    // Keep terminal outcome; cannot re-list a sold/returned gem via patch.
    next.outcome = current.outcome;
  }

  return next;
}

/** Map a legacy flat status pick onto the matching axis patch. */
export function patchFromFlatStatus(status: GemStatus): {
  stoneStage?: GemStoneStage;
  custody?: GemCustody | null;
  outcome?: GemOutcome | null;
} {
  if (isGemStoneStage(status)) return { stoneStage: status };
  if (isGemCustody(status)) return { custody: status };
  if (isGemOutcome(status)) return { outcome: status };
  if (status === "certified" || status === "ready_for_sale") {
    return { stoneStage: "polished" };
  }
  return {};
}

export function gemMatchesStatusFilter(
  gem: WorkspaceGem,
  filter: GemStatus | "all",
): boolean {
  if (filter === "all") return true;
  const life = resolveGemLifecycle(gem);
  if (life.stoneStage === filter) return true;
  if (life.custody === filter) return true;
  if (life.outcome === filter) return true;
  if (
    filter === "listed" &&
    gem.isListedOnMarketplace &&
    !isTerminalOutcome(life.outcome)
  ) {
    return true;
  }
  return gem.status === filter;
}

export function formatLifecycleSummary(lifecycle: GemLifecycle): string {
  const parts = [formatGemStatusLabel(lifecycle.stoneStage)];
  if (lifecycle.custody) parts.push(formatGemStatusLabel(lifecycle.custody));
  if (lifecycle.outcome) parts.push(formatGemStatusLabel(lifecycle.outcome));
  return parts.filter(Boolean).join(" · ");
}

export function canListGem(
  gem: Pick<
    WorkspaceGem,
    "status" | "stoneStage" | "custody" | "outcome" | "isListedOnMarketplace"
  >,
): boolean {
  const life = resolveGemLifecycle(gem);
  if (isTerminalOutcome(life.outcome)) return false;
  if (life.outcome === "listed" || gem.isListedOnMarketplace) return false;
  if (life.stoneStage === "rough") return false;
  return true;
}
