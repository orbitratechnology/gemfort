import type {
  Business,
  BusinessReputationBadge as BusinessReputationBadgeType,
} from "@/types";

export const BUSINESS_REPUTATION_BADGE_LABELS: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  string
> = {
  member: "Member",
  identity: "Identity Verified",
  business: "Business Verified",
  gem: "Gem Verified",
  recognized: "Recognized",
};

export function parseBusinessReputationBadge(
  value: unknown,
): BusinessReputationBadgeType | null {
  if (value === "full" || value === "ultra") return "gem";
  if (value === "basic") return "identity";
  if (value === "pro") return "business";
  if (
    value === "none" ||
    value === "member" ||
    value === "identity" ||
    value === "business" ||
    value === "gem" ||
    value === "recognized"
  ) {
    return value;
  }
  return null;
}

export function businessReputationBadgeForBusiness(
  business: Pick<
    Business,
    | "verificationStatus"
    | "verificationTier"
    | "badges"
    | "recognizedBadgeAssignedAt"
    | "recognizedBadgeAssignedByAdminUid"
  > | null | undefined,
): BusinessReputationBadgeType {
  if (!business) return "none";

  const configured = parseBusinessReputationBadge(
    business?.badges?.businessReputation,
  );
  const hasRecognizedMetadata =
    business.recognizedBadgeAssignedAt != null ||
    business.recognizedBadgeAssignedByAdminUid != null;
  if (configured === "recognized" || hasRecognizedMetadata) return "recognized";
  if (business.verificationStatus !== "verified") return "member";
  if (configured && configured !== "none") return configured;
  return parseBusinessReputationBadge(business.verificationTier) ?? "member";
}
