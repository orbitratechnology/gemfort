import type { IconName } from "@/components/ui/icon";

export type BusinessProfileSection =
  | "photos"
  | "identity"
  | "location"
  | "services"
  | "contact-social"
  | "contact"
  | "website"
  | "social";

export const BUSINESS_PROFILE_SECTIONS: readonly {
  id: BusinessProfileSection;
  icon: IconName;
  label: string;
  subtitle: string;
}[] = [
  {
    id: "photos",
    icon: "photo-library",
    label: "Business Photos",
    subtitle: "Logo, cover, and gallery",
  },
  {
    id: "identity",
    icon: "business",
    label: "Identity",
    subtitle: "Business name and bio",
  },
  {
    id: "location",
    icon: "location-on",
    label: "Location",
    subtitle: "Country, city, address, and map pin",
  },
  {
    id: "services",
    icon: "content-cut",
    label: "Public Services",
    subtitle: "Workshop services and pricing",
  },
  {
    id: "contact-social",
    icon: "share",
    label: "Contact & Social",
    subtitle: "Phone, website, and social profiles",
  },
  {
    id: "contact",
    icon: "phone",
    label: "Contact",
    subtitle: "WhatsApp and phone",
  },
  {
    id: "website",
    icon: "language",
    label: "Website",
    subtitle: "Public website URL",
  },
  {
    id: "social",
    icon: "share",
    label: "Social",
    subtitle: "Instagram, TikTok, Facebook, and WeChat",
  },
];

export function isBusinessProfileSection(
  value: string | string[] | undefined,
): value is BusinessProfileSection {
  return (
    typeof value === "string" &&
    BUSINESS_PROFILE_SECTIONS.some((section) => section.id === value)
  );
}

export function businessProfileSectionTitle(
  section: BusinessProfileSection,
): string {
  return BUSINESS_PROFILE_SECTIONS.find((item) => item.id === section)?.label ??
    "Edit Business";
}
