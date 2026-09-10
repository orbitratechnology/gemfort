import type {
  Business,
  BusinessReputationBadge as BusinessReputationBadgeType,
} from "@/types";

export const BUSINESS_REPUTATION_BADGE_LABELS: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  string
> = {
  basic: "Basic",
  pro: "Pro",
  ultra: "Ultra",
  member: "Member",
};

export function parseBusinessReputationBadge(
  value: unknown,
): BusinessReputationBadgeType | null {
  if (value === "full") return "ultra";
  if (
    value === "none" ||
    value === "basic" ||
    value === "pro" ||
    value === "ultra" ||
    value === "member"
  ) {
    return value;
  }
  return null;
}

export function businessReputationBadgeForBusiness(
  business: Pick<
    Business,
    "verificationStatus" | "verificationTier" | "badges"
  > | null | undefined,
): BusinessReputationBadgeType {
  const configured = parseBusinessReputationBadge(
    business?.badges?.businessReputation,
  );
  if (configured === "member") return configured;
  if (!business || business.verificationStatus !== "verified") return "none";
  if (configured) return configured;
  return parseBusinessReputationBadge(business.verificationTier) ?? "none";
}
