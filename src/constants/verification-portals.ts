export type VerificationLab = {
  name: string;
  url: string;
  requiredInfo?: string;
  mark: string;
};

export type VerificationGroup = {
  title: string;
  subtitle: string;
  icon: "flag" | "language";
  labs: VerificationLab[];
};

export const VERIFICATION_GROUPS: VerificationGroup[] = [
  {
    title: "Sri Lankan laboratories",
    subtitle: "Local certificate and report portals",
    icon: "flag",
    labs: [
      {
        name: "National Gem and Jewellery Authority (NGJA)",
        url: "https://gemlab-certificate.ngja.gov.lk/",
        requiredInfo: "Certificate number / RVN",
        mark: "NGJA",
      },
      {
        name: "Gemmological Institute of Colombo (GIC)",
        url: "https://www.gicolombo.com/certificate-verification.html",
        requiredInfo: "Report RVN / ID number, certified date, and stone weight",
        mark: "GIC",
      },
      {
        name: "Ceylon Gem Laboratory (CGL Sri Lanka)",
        url: "https://www.ceylongemlaboratory.com/gem-report",
        mark: "CGL",
      },
      {
        name: "Arctic Gem Certification & Laboratory (AGCL)",
        url: "https://www.agclgemlab.com/",
        requiredInfo: "Reference number",
        mark: "AGCL",
      },
    ],
  },
  {
    title: "Major global gem laboratories",
    subtitle: "Internationally recognized report verification",
    icon: "language",
    labs: [
      {
        name: "Gemological Institute of America (GIA)",
        url: "https://www.gia.edu/report-check-landing",
        requiredInfo: "10-digit report number",
        mark: "GIA",
      },
      {
        name: "International Gemological Institute (IGI)",
        url: "https://www.igi.org/Verify-Your-Report/",
        requiredInfo: "Report number or QR code scan",
        mark: "IGI",
      },
      {
        name: "HRD Antwerp",
        url: "https://my.hrdantwerp.com/",
        requiredInfo: "Report number and carat weight",
        mark: "HRD",
      },
      {
        name: "GRS (GemResearch Swisslab)",
        url: "https://www.gemresearch.ch/report-verification",
        requiredInfo: "Report number, date, and weight (or QR code scan)",
        mark: "GRS",
      },
      {
        name: "Swiss Gemmological Institute (SSEF)",
        url: "https://www.myssef.ch/",
        requiredInfo: "Report number and weight",
        mark: "SSEF",
      },
      {
        name: "G\u00FCbelin Gem Lab",
        url: "https://services.gubelingemlab.com/Document_Verification",
        requiredInfo:
          "Document number and verification code (post-2018), or date and weight (pre-2019)",
        mark: "GGL",
      },
      {
        name: "Lotus Gemology",
        url: "https://lotusgemology.com/reports/report-lookup?view=report",
        requiredInfo: "Report number and PIN (on the report or security card)",
        mark: "LOTUS",
      },
    ],
  },
  {
    title: "Specialized & regional laboratories",
    subtitle: "Additional international verification services",
    icon: "language",
    labs: [
      {
        name: "GUILD Gem Laboratories",
        url: "https://www.guildgemlab.com/laboratory/verify/",
        requiredInfo: "Certificate number",
        mark: "GUILD",
      },
      {
        name: "European Gemological Laboratory (EGL International)",
        url: "https://www.egllaboratories.org/",
        mark: "EGL",
      },
      {
        name: "EGL USA",
        url: "https://www.eglusa.com/verify-a-report/",
        mark: "EGL",
      },
      {
        name: "CGL Labs (International Diamond Verification)",
        url: "https://www.cgl-labs.com/online-verification",
        requiredInfo: "Certificate number and weight",
        mark: "CGL",
      },
    ],
  },
];

export type VerificationListItem =
  | {
      type: "heading";
      id: string;
      title: string;
      subtitle: string;
      icon: VerificationGroup["icon"];
    }
  | {
      type: "lab";
      id: string;
      lab: VerificationLab;
      firstInGroup: boolean;
    };

export const VERIFICATION_LIST_ITEMS: VerificationListItem[] = VERIFICATION_GROUPS.flatMap(
  (group) => [
    {
      type: "heading" as const,
      id: `heading-${group.title}`,
      title: group.title,
      subtitle: group.subtitle,
      icon: group.icon,
    },
    ...group.labs.map((lab, index) => ({
      type: "lab" as const,
      id: `${group.title}-${lab.name}`,
      lab,
      firstInGroup: index === 0,
    })),
  ],
);
