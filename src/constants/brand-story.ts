/** GemFort brand voice and storytelling copy */

export const Brand = {
  name: "GemFort",
  tagline: "Every stone has a story",
  subtagline: "Trusted gems. Clear records. Real connections.",
  products: {
    gemNet: "GemNet",
    gemTrack: "GemTrack",
  },
} as const;

export type OnboardingChapterId =
  | "welcome"
  | "lapidaries"
  | "labs"
  | "workspace"
  | "roles";

export type OnboardingRoleCue = {
  id: "trader" | "lapidary" | "gem_lab";
  label: string;
  subtitle: string;
  icon: "storefront" | "handyman" | "workspace-premium";
};

export type OnboardingChapter = {
  id: OnboardingChapterId;
  title: string;
  /** Optional second line under the title (e.g. last-slide role lead-in). */
  subtitle?: string;
  body: string;
  /** Primary CTA label for non-final slides */
  cta: string;
  roles?: readonly OnboardingRoleCue[];
};

export const OnboardingChapters: readonly OnboardingChapter[] = [
  {
    id: "welcome",
    title: "Trusted gems. Clear records. Real connections.",
    body: "Welcome to GemFort — built for how the gem trade actually works, from Beruwala to connected markets.",
    cta: "Continue",
  },
  {
    id: "lapidaries",
    title: "Built for Lapidaries",
    body: "Run cutting, heating, and polish jobs in one place — track weight loss, services, and payments without the notebook.",
    cta: "Continue",
  },
  {
    id: "labs",
    title: "Gem labs, certificates & verification",
    body: "Issue reports, manage certificate work, and let anyone verify a stone by report number — trust that travels with the gem.",
    cta: "Continue",
  },
  {
    id: "workspace",
    title: "Cheques, bills, AP, inventory & trips",
    body: "GemTrack keeps post-dated cheques, bills, stones on approval, inventory, and sourcing trips clear — so you always know where stones and money are.",
    cta: "Continue",
  },
  {
    id: "roles",
    title: "GemFort. By Orbitra Tech",
    subtitle: "Traders, Lapidaries & Labs.",
    body: "Choose your role when you create an account. Or browse the market as a guest.",
    cta: "Create account",
    roles: [
      {
        id: "trader",
        label: "Trader",
        subtitle: "Buy, sell, AP & cheques",
        icon: "storefront",
      },
      {
        id: "lapidary",
        label: "Lapidary",
        subtitle: "Jobs, cutting & polish",
        icon: "handyman",
      },
      {
        id: "gem_lab",
        label: "Gem Lab",
        subtitle: "Reports, certificates & verification",
        icon: "workspace-premium",
      },
    ],
  },
] as const;

export const HomeStory = {
  greeting: "Welcome to GemFort",
  lead: "Your marketplace for trusted gem businesses and private inventory tracking.",
  chapters: [
    {
      title: "Discover",
      body: "Find verified businesses in the market.",
      route: "/(marketplace)/(tabs)/market" as const,
    },
    {
      title: "Track",
      body: "Manage gems, services, and money in Workspace.",
      route: "/(marketplace)/(tabs)/workspace" as const,
    },
  ],
} as const;
