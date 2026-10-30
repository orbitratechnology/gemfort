import { StyleSheet, View } from "react-native";

import { SegmentedControl } from "@/components/money/segmented-control";
import {
  ChoiceTileGrid,
  type ChoiceTileOption,
} from "@/components/ui/choice-tile-grid";
import { FieldLabel, FieldMessage } from "@/components/ui/field-chrome";
import { Spacing } from "@/constants/design-tokens";
import {
  repeatServiceType,
  suggestedServiceType,
  type RepeatableServiceType,
} from "@/features/workspace/service-utils";
import type { GemStoneStage } from "@/types";

type ServiceKind = RepeatableServiceType | "appraisal";

export const SERVICE_TYPES = [
  { id: "cutting", label: "Cutting", hint: "Facet the rough for the first time" },
  { id: "recutting", label: "Recutting", hint: "Re-facet a stone that's already cut" },
  { id: "heating", label: "Heating", hint: "First heat treatment" },
  { id: "reheating", label: "Reheating", hint: "Another heat cycle on a heated stone" },
  { id: "polishing", label: "Polishing", hint: "Bring out the luster" },
  { id: "repolishing", label: "Repolishing", hint: "Refresh an existing polish" },
  { id: "appraisal", label: "Appraisal", hint: "Grading and valuation" },
] as const;

const KIND_OPTIONS: ChoiceTileOption<ServiceKind>[] = [
  { value: "cutting", label: "Cut", icon: "content-cut" },
  { value: "heating", label: "Heat", icon: "local-fire-department" },
  { value: "polishing", label: "Polish", icon: "auto-fix-high" },
  { value: "appraisal", label: "Appraise", icon: "verified" },
];

function kindOf(serviceType: string): ServiceKind {
  if (serviceType.includes("cut")) return "cutting";
  if (serviceType.includes("heat")) return "heating";
  if (serviceType.includes("polish")) return "polishing";
  return "appraisal";
}

function labelOf(serviceType: string): string {
  return SERVICE_TYPES.find((t) => t.id === serviceType)?.label ?? serviceType;
}

/** Keeps the work kind but re-picks first-time vs repeat for a newly chosen stone. */
export function serviceTypeForStage(
  serviceType: string,
  stoneStage: GemStoneStage | null | undefined,
): string {
  const kind = kindOf(serviceType);
  return kind === "appraisal" ? kind : suggestedServiceType(kind, stoneStage);
}

/**
 * Work kind as four tiles, then a first-time / repeat toggle (Cutting |
 * Recutting) pre-set from the stone's stage.
 */
export function ServiceTypePicker({
  value,
  onChange,
  stoneStage,
  error,
}: {
  value: string;
  onChange: (serviceType: string) => void;
  stoneStage?: GemStoneStage | null;
  error?: string;
}) {
  const kind = kindOf(value);
  const hint = SERVICE_TYPES.find((t) => t.id === value)?.hint;

  return (
    <View style={styles.wrap}>
      <FieldLabel>Service type</FieldLabel>
      <ChoiceTileGrid
        layout="row"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(next) => {
          if (next === kind) return;
          onChange(next === "appraisal" ? next : suggestedServiceType(next, stoneStage));
        }}
        error={error}
      />
      {kind !== "appraisal" ? (
        <SegmentedControl
          accessibilityLabel="First time or repeat"
          options={[
            { id: kind, label: labelOf(kind) },
            { id: repeatServiceType(kind), label: labelOf(repeatServiceType(kind)) },
          ]}
          value={value}
          onChange={onChange}
        />
      ) : null}
      {error ? null : <FieldMessage helperText={hint} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
});
