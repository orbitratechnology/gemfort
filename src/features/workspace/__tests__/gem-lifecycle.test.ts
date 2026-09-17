import {
  gemActionAvailability,
  normalizeGemTreatment,
  resolveGemLifecycle,
} from "@/features/workspace/gem-lifecycle";
import type { WorkspaceGem } from "@/types";

jest.mock("@/constants/gem-options", () => ({
  formatGemStatusLabel: (status: string) => status,
}));

function gem(overrides: Partial<WorkspaceGem> = {}): WorkspaceGem {
  return {
    id: "gem-1",
    ownerUid: "owner-1",
    status: "polished",
    isListedOnMarketplace: false,
    stoneStage: "polished",
    custody: null,
    outcome: null,
    ...overrides,
  } as WorkspaceGem;
}

describe("gem lapidary actions", () => {
  it("allows each lapidary service from any stone stage", () => {
    for (const stoneStage of ["rough", "cut", "heated", "polished"] as const) {
      const available = gemActionAvailability(gem({ stoneStage, status: stoneStage }));

      expect(available.send_for_cutting).toBe(true);
      expect(available.send_for_heating).toBe(true);
      expect(available.send_for_polishing).toBe(true);
    }
  });

  it("keeps lapidary actions unavailable while the gem is away", () => {
    const available = gemActionAvailability(
      gem({ custody: "with_heater", status: "with_heater" }),
    );

    expect(available.send_for_cutting).toBe(false);
    expect(available.send_for_heating).toBe(false);
    expect(available.send_for_polishing).toBe(false);
  });

  it("resolves a legacy service custody status without imposing stage order", () => {
    expect(resolveGemLifecycle(gem({ status: "with_polisher", stoneStage: null }))).toEqual({
      stoneStage: "cut",
      custody: "with_polisher",
      outcome: null,
    });
  });
});

describe("normalizeGemTreatment", () => {
  it("defaults a newly heated gem to heated treatment", () => {
    expect(normalizeGemTreatment(undefined, "heated", undefined)).toEqual({
      isNatural: false,
      treatmentStatus: "heated",
    });
  });

  it("forces heated treatment for a heated stone stage", () => {
    expect(normalizeGemTreatment("natural", "heated", true)).toEqual({
      isNatural: false,
      treatmentStatus: "heated",
    });
  });

  it("keeps heated treatment non-natural after cutting or polishing", () => {
    expect(normalizeGemTreatment("heated", "polished", true)).toEqual({
      isNatural: false,
      treatmentStatus: "heated",
    });
  });
});
