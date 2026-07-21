import { LAB_CERTIFICATE_TYPE_OPTIONS } from "@/constants/roles";
import type { LabCertificateOffering } from "@/types";

/** Map legacy free-text reportTypes onto the standard catalog. */
const LEGACY_REPORT_TO_ID: Record<string, string> = {
  brief: "gem_brief_memo",
  full: "standard_photo_certificate",
  origin: "advanced_origin_certificate",
  identification: "standard_photo_certificate",
  diamond: "diamond_grading_report",
};

export function defaultLabCertificateOfferings(
  currency = "LKR",
): LabCertificateOffering[] {
  return LAB_CERTIFICATE_TYPE_OPTIONS.map((opt) => ({
    id: opt.id,
    title: opt.title,
    description: opt.description,
    price: null,
    currency,
    isActive: true,
  }));
}

/**
 * Merge saved offerings with the standard catalog so labs always see all tiers.
 * Seeds from legacy `reportTypes` when offerings were never saved.
 */
export function normalizeLabCertificateOfferings(
  existing: LabCertificateOffering[] | undefined | null,
  legacyReportTypes?: string[],
  currency = "LKR",
): LabCertificateOffering[] {
  const byId = new Map((existing ?? []).map((o) => [o.id, o]));
  const hasExisting = (existing?.length ?? 0) > 0;
  const legacyActive = new Set(
    (legacyReportTypes ?? []).map((t) => LEGACY_REPORT_TO_ID[t] ?? t),
  );

  return LAB_CERTIFICATE_TYPE_OPTIONS.map((opt) => {
    const found = byId.get(opt.id);
    if (found) {
      return {
        id: opt.id,
        title: found.title?.trim() || opt.title,
        description: found.description?.trim() || opt.description,
        price:
          typeof found.price === "number" && Number.isFinite(found.price)
            ? found.price
            : null,
        currency: found.currency?.trim() || currency,
        isActive: !!found.isActive,
      };
    }

    const activeFromLegacy =
      !hasExisting && legacyActive.size > 0
        ? legacyActive.has(opt.id)
        : !hasExisting;

    return {
      id: opt.id,
      title: opt.title,
      description: opt.description,
      price: null,
      currency,
      isActive: activeFromLegacy,
    };
  });
}

export function reportTypesFromOfferings(
  offerings: LabCertificateOffering[],
): string[] {
  return offerings.filter((o) => o.isActive).map((o) => o.id);
}

/** Sanitize client drafts before Firestore write. */
export function sanitizeLabCertificateOfferings(
  offerings: LabCertificateOffering[],
): LabCertificateOffering[] {
  return normalizeLabCertificateOfferings(offerings).map((o) => ({
    ...o,
    price:
      o.price != null && Number.isFinite(o.price) && o.price >= 0
        ? Math.round(o.price)
        : null,
  }));
}
