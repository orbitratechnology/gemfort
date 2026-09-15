import type { ConfigContext, ExpoConfig } from "expo/config";

const env = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

// All EAS environments use the same native app and Firebase configuration.
const bundleId = "app.gemfort";

// Shared image artwork used by both iOS and Android system shortcuts.
const SHORTCUT_IMAGES = {
  shortcut_app: "./assets/images/gemfort-icon.png",
  shortcut_add: "./assets/images/mygems-icon.png",
  shortcut_ap: "./assets/images/ap-icon.png",
  shortcut_bill: "./assets/images/bill-icon.png",
  shortcut_cheque: "./assets/images/cheque-icon.png",
  shortcut_contacts: "./assets/images/ap-icon.png",
  shortcut_gem: "./assets/images/mygems-icon.png",
  shortcut_jobs: "./assets/images/lapidary-icon.png",
  shortcut_market: "./assets/images/mygems-icon.png",
  shortcut_money: "./assets/images/bill-icon.png",
  shortcut_search: "./assets/images/gemfort-icon.png",
  shortcut_service: "./assets/images/lapidary-icon.png",
  shortcut_trip: "./assets/images/trips-icon.png",
} as const;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "GemFort",
  slug: "gemfort",
  version: "1.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  primaryColor: "#171717",
  backgroundColor: "#000000",
  scheme: "gemfort",
  userInterfaceStyle: "automatic",
  buildCacheProvider: "eas",
  updates: {
    url: "https://u.expo.dev/4ef3ea53-839b-47a2-9621-2875c6fa182d",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  ios: {
    // SDK 54+: Icon Composer .icon (Liquid Glass). Fallback PNGs kept for tooling.
    icon: "./assets/app-icon.icon",
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains:
      env === "production" || env === "preview" ? ["applinks:gemfort.app"] : [],
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? "GoogleService-Info.plist",
  },
  android: {
    package: bundleId,
    // Keep focused inputs visible above the keyboard (esp. with bottom tabs).
    softwareKeyboardLayoutMode: "pan",
    adaptiveIcon: {
      // Black plate; foreground mark is inset (~52%) for circular / squircle masks
      backgroundColor: "#000000",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // Pre-adaptive / Play listing fallback
    icon: "./assets/images/icon.png",
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? "google-services.json",
    intentFilters:
      env === "production" || env === "preview"
        ? [
            {
              action: "VIEW",
              autoVerify: true,
              data: [
                {
                  scheme: "https",
                  host: "gemfort.app",
                  pathPrefix: "/l",
                },
              ],
              category: ["BROWSABLE", "DEFAULT"],
            },
          ]
        : [],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    // "./plugins/with-adi-registration",
    "expo-router",
    [
      "expo-sharing",
      {
        ios: {
          enabled: true,
          activationRule: {
            supportsImageWithMaxCount: 10,
            supportsFileWithMaxCount: 5,
            supportsText: true,
            supportsWebUrlWithMaxCount: 3,
          },
        },
        android: {
          enabled: true,
          singleShareMimeTypes: [
            "image/*",
            "application/pdf",
            "text/plain",
            "text/*",
          ],
          multipleShareMimeTypes: ["image/*"],
        },
      },
    ],
    "expo-dev-client",
    "expo-font",
    "expo-image",
    "@maplibre/maplibre-react-native",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "GemFort uses your location to place your business on its public profile.",
      },
    ],
    "expo-secure-store",
    "expo-status-bar",
    "expo-web-browser",
    "expo-apple-authentication",
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Allow GemFort to use Face ID to protect your account.",
      },
    ],
    "react-native-nitro-google-signin",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-firebase/app-check",
    "@react-native-vector-icons/material-icons",
    "@react-native-vector-icons/fontawesome6",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          forceStaticLinking: [
            "RNFBApp",
            "RNFBAuth",
            "RNFBAppCheck",
            "RNFBFirestore",
            "RNFBStorage",
          ],
        },
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/images/splash-icon.png",
        // dp width of the splash icon box; mark itself is inset for Android's circular mask
        imageWidth: 200,
        resizeMode: "contain",
        dark: {
          backgroundColor: "#000000",
          image: "./assets/images/splash-icon.png",
        },
      },
    ],
    [
      "expo-notifications",
      {
        // Android status-bar small icon must be white alpha silhouette
        icon: "./assets/images/notification-icon.png",
        color: "#64A0F7",
        defaultChannel: "default",
        enableBackgroundRemoteNotifications: true,
      },
    ],
    [
      "react-native-notify-kit",
      {
        ios: {
          notificationServiceExtension: true,
        },
      },
    ],
    [
      "expo-quick-actions",
      {
        // Use the same image in light and dark system menus.
        androidIcons: SHORTCUT_IMAGES,
        iosIcons: SHORTCUT_IMAGES,
        // Static iOS actions available before JS loads; replaced dynamically by role.
        // Use the same bundled template images as the dynamic actions.
        iosActions: [
          {
            id: "certificate-portals",
            title: "Certificate portals",
            subtitle: "Open external verification pages",
            icon: "asset:shortcut_app",
            params: { href: "/verify-certificate-portals" },
          },
          {
            id: "market",
            title: "Market",
            subtitle: "Find traders and lapidaries",
            icon: "asset:shortcut_market",
            params: { href: "/(marketplace)/(tabs)/market" },
          },
          {
            id: "search",
            title: "Search",
            icon: "asset:shortcut_search",
            params: { href: "/(marketplace)/(tabs)/search" },
          },
        ],
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "GemFort needs photo access to upload gem images.",
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "GemFort needs contacts access to import contacts from your phone.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "4ef3ea53-839b-47a2-9621-2875c6fa182d",
    },
    appEnv: env,
  },
  owner: "orbitratech",
});
