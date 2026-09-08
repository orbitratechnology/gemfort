import type { IconName } from "@/components/ui/icon";

export const CONTACT_TYPES = [
  "trader",
  "cutter",
  "buyer",
  "supplier",
  "heater",
  "polisher",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export type ContactTypeOption = {
  value: ContactType;
  label: string;
  icon: IconName;
};

export const CONTACT_TYPE_OPTIONS = [
  { value: "trader", label: "Trader", icon: "storefront" },
  { value: "cutter", label: "Cutter", icon: "content-cut" },
  { value: "buyer", label: "Buyer", icon: "shopping-bag" },
  { value: "supplier", label: "Supplier", icon: "local-shipping" },
  { value: "heater", label: "Heater", icon: "local-fire-department" },
  { value: "polisher", label: "Polisher", icon: "auto-awesome" },
  { value: "other", label: "Other", icon: "more-horiz" },
] as const satisfies readonly ContactTypeOption[];

const LEGACY_CONTACT_TYPE_ALIASES: Record<string, ContactType> = {
  broker: "trader",
};

export function normalizeContactType(value: string): ContactType {
  const normalized = LEGACY_CONTACT_TYPE_ALIASES[value] ?? value;
  return CONTACT_TYPES.includes(normalized as ContactType)
    ? (normalized as ContactType)
    : "other";
}

export function normalizeContactTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map(normalizeContactType),
    ),
  ];
}

export function getContactTypeOption(value: string): ContactTypeOption {
  const normalized = normalizeContactType(value);
  return (
    CONTACT_TYPE_OPTIONS.find((option) => option.value === normalized) ?? {
      value: "other",
      label: normalized || "Other",
      icon: "more-horiz",
    }
  );
}
