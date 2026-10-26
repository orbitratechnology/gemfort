import type { TourDefinition } from "guideway";

export const APP_TOURS: TourDefinition[] = [
  {
    id: "home",
    showOnce: true,
    steps: [
      {
        id: "home-profile",
        title: "Your business profile",
        body: "Update your business details and preferences here.",
        placement: "bottom",
      },
      {
        id: "home-notifications",
        title: "Stay up to date",
        body: "Important updates and reminders appear in your notifications.",
        placement: "bottom",
      },
      {
        id: "home-actions",
        title: "Start a task quickly",
        body: "Tap + to add something or verify a certificate.",
        placement: "top",
      },
    ],
  },
  {
    id: "workspace",
    steps: [
      {
        id: "workspace-overview",
        title: "A quick business overview",
        body: "See your inventory or workshop activity at a glance.",
        placement: "bottom",
      },
      {
        id: "workspace-modules",
        title: "Find the tools you need",
        body: "Browse the sections for gems, trips, bills, cheques, and contacts.",
        placement: "top",
      },
      {
        id: "workspace-actions",
        title: "Create or update something",
        body: "Use + for common tasks, like adding a gem or recording a bill.",
        placement: "top",
      },
    ],
  },
  {
    id: "money",
    steps: [
      {
        id: "money-period",
        title: "Choose a time period",
        body: "Use these options to review your money for a different period.",
        placement: "bottom",
      },
      {
        id: "money-date-filter",
        title: "Pick your own dates",
        body: "Tap the calendar to choose a custom date range.",
        placement: "bottom",
      },
      {
        id: "money-record-sale",
        title: "Record a sale",
        body: "Tap + when you want to add a sale to your records.",
        placement: "top",
      },
    ],
  },
];
