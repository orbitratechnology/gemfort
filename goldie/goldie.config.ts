const APP_ROOT = "C:/Users/bilal/Workspace/gemfort";

const config = {
  appRoot: APP_ROOT,
  flowsDir: "../.argent/flows",
  appPath: "./input/gemfort-dev.apk",
  bundleId: "app.gemfort",
  android: {
    appPath: "./input/gemfort-dev.apk",
    applicationId: "app.gemfort",
  },
  devices: ["pixel-10-pro"],
  locales: ["en-US"],
  appearance: "light",
  frame: { variant: "17-pro-blue" },
  theme: {
    background: "linear-gradient(155deg, #EEF4FF 0%, #FFFFFF 52%, #F3EEFF 100%)",
    headlineColor: "#121826",
    subheadColor: "#667085",
    fontFamily: "DM Sans",
    copyHeightRatio: 0.24,
    deviceWidthRatio: 0.84,
    template: ["hero", "offset", "classic", "copy-below", "tilt-right"],
    layout: "classic",
  },
  store: {
    name: "GemFort",
    subtitle: { "en-US": "Trade gems with confidence" },
    developer: "GemFort",
    category: "Business",
    rating: 4.8,
    ratingCount: "48 Ratings",
    ageRating: "3+",
    price: "Free",
    description: {
      "en-US":
        "GemFort brings your gem trade into one calm workspace. Discover traders, track stones, verify certificates, and keep the details close at hand.",
    },
  },
  scenes: [
    {
      kind: "screenshot",
      id: "home",
      flow: "store-01-home",
      headline: { "en-US": "Keep every trade in view" },
      subhead: { "en-US": "Your market, workspace, and money in one place." },
      decorations: [
        {
          kind: "badge",
          text: { "en-US": "GEMFORT" },
          position: "top-left",
          background: "#121826",
          color: "#FFFFFF",
        },
      ],
    },
    {
      kind: "screenshot",
      id: "ap",
      flow: "store-02-ap",
      headline: { "en-US": "Offer stones with clear terms" },
      subhead: { "en-US": "Send an approval request with the return window built in." },
      background: "linear-gradient(155deg, #FFF7ED 0%, #FFFFFF 56%, #EEF4FF 100%)",
    },
    {
      kind: "screenshot",
      id: "workspace",
      flow: "store-03-workspace",
      headline: { "en-US": "Know every stone" },
      subhead: { "en-US": "See state, location, and ownership at a glance." },
      background: "linear-gradient(155deg, #F1EEFF 0%, #FFFFFF 58%, #EEF4FF 100%)",
      secondScene: "home",
    },
    {
      kind: "screenshot",
      id: "verify",
      flow: "store-04-verify",
      headline: { "en-US": "Verify before you buy" },
      subhead: { "en-US": "Open trusted local and global lab portals in one place." },
      background: "linear-gradient(155deg, #ECFDF3 0%, #FFFFFF 55%, #EEF4FF 100%)",
    },
    {
      kind: "screenshot",
      id: "money",
      flow: "store-05-money",
      headline: { "en-US": "See the money clearly" },
      subhead: { "en-US": "Keep income, expenses, and cash flow close." },
      background: "linear-gradient(155deg, #EEF4FF 0%, #FFFFFF 52%, #FFF7ED 100%)",
    },
  ],
};

export default config;
