import type { IconName } from "@/components/ui/icon";

export const LISTING_VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    icon: "public" as IconName,
    searchText: "Anyone can view this listing",
  },
  {
    value: "contacts",
    label: "Contacts",
    icon: "contacts" as IconName,
    searchText: "Only your contacts can view",
  },
] as const;
