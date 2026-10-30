import type {
  Business,
  BusinessReputationBadge as BusinessReputationBadgeType,
  UserProfile,
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

/**
 * Shared tier colors used anywhere a verification level is represented by color.
 * Member stays in GemFort graphite; verified tiers step through jewel tones
 * (emerald → sapphire → gold → ruby), kept deep and muted.
 */
export const BUSINESS_REPUTATION_BADGE_COLORS: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  string
> = {
  member: "#5C5C5C",
  identity: "#2E7553",
  business: "#3A5A8E",
  gem: "#A9842F",
  recognized: "#8C2F42",
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

/** Badge shown for the signed-in owner: profile-level overrides on top of the business tier. */
export function reputationBadgeForOwner(
  profile: Pick<UserProfile, "recognizedBadge" | "verificationStatus"> | null | undefined,
  business: Parameters<typeof businessReputationBadgeForBusiness>[0],
): Exclude<BusinessReputationBadgeType, "none"> {
  if (profile?.recognizedBadge) return "recognized";
  const fromBusiness = business ? businessReputationBadgeForBusiness(business) : "member";
  if (fromBusiness === "none") return "member";
  if (profile?.verificationStatus === "verified" && fromBusiness === "member") {
    return "identity";
  }
  return fromBusiness;
}
