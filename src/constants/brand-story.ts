/** GemFort brand voice and storytelling copy */

export const Brand = {
  name: 'GemFort',
  tagline: 'Every stone has a story',
  subtagline: 'Trusted gems. Clear records. Real connections.',
  products: {
    gemNet: 'GemNet',
    gemTrack: 'GemTrack',
  },
} as const;

export const OnboardingChapters = [
  {
    id: 'story',
    title: 'Every stone has a story',
    body: 'From rough to polished, GemFort helps you follow the journey of each gem with clarity and care.',
    accent: 'gemBlue' as const,
  },
  {
    id: 'trust',
    title: 'Trust you can see',
    body: 'Browse verified sellers and service providers in Beruwala and beyond. Verification badges mean peace of mind.',
    accent: 'verified' as const,
  },
  {
    id: 'workspace',
    title: 'Your private workspace',
    body: 'Track inventory, services, and payments in GemTrack. Connect on WhatsApp when you are ready to deal.',
    accent: 'gold' as const,
  },
] as const;

export const HomeStory = {
  greeting: 'Welcome to GemFort',
  lead: 'Your marketplace for trusted gem businesses and private inventory tracking.',
  chapters: [
    {
      title: 'Discover',
      body: 'Find verified businesses in the directory.',
      route: '/(marketplace)/(tabs)/directory' as const,
    },
    {
      title: 'Track',
      body: 'Manage gems, services, and money in Workspace.',
      route: '/(marketplace)/(tabs)/workspace' as const,
    },
  ],
} as const;
