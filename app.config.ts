import type { ConfigContext, ExpoConfig } from "expo/config";

const env = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

const bundleIds: Record<string, string> = {
  development: "app.gemfort.dev",
  preview: "app.gemfort.preview",
  production: "app.gemfort",
};

const bundleId = bundleIds[env] ?? bundleIds.development;

/** Single Firebase project (gemfort); native config files differ per EAS bundle ID. */
const googleServicesSuffix =
  env === "production" ? "" : env === "preview" ? ".preview" : ".dev";

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
      process.env.GOOGLE_SERVICES_PLIST ??
      `./google-services/GoogleService-Info${googleServicesSuffix}.plist`,
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
      process.env.GOOGLE_SERVICES_JSON ??
      "./google-services/google-services.json",
    permissions: [
      "android.permission.READ_CALL_LOG",
      "android.permission.READ_PHONE_STATE",
    ],
    // Library manifests WRITE_CALL_LOG; we only read history.
    blockedPermissions: ["android.permission.WRITE_CALL_LOG"],
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
    "expo-secure-store",
    "expo-status-bar",
    "expo-web-browser",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
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
            "RNFBFirestore",
            "RNFBStorage",
          ],
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
      },
    ],
    [
      "expo-quick-actions",
      {
        // Android shortcuts can be pinned — adaptive icons act as alt entry points.
        // Foreground: white silhouette with ~30% padding (Material shortcut guidance).
        androidIcons: {
          shortcut_verify: {
            foregroundImage: "./assets/images/notification-icon.png",
            backgroundColor: "#64A0F7",
          },
          shortcut_add: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#171717",
          },
          shortcut_ap: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#0F766E",
          },
          shortcut_service: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#B45309",
          },
          shortcut_jobs: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#B45309",
          },
          shortcut_contacts: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#1D4ED8",
          },
          shortcut_bill: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#171717",
          },
          shortcut_certificates: {
            foregroundImage: "./assets/images/notification-icon.png",
            backgroundColor: "#7C3AED",
          },
          shortcut_money: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#15803D",
          },
          shortcut_directory: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#1D4ED8",
          },
          shortcut_search: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#171717",
          },
          shortcut_news: {
            foregroundImage: "./assets/images/android-icon-monochrome.png",
            backgroundColor: "#334155",
          },
        },
        // Static iOS actions available before JS loads; replaced dynamically by role.
        iosActions: [
          {
            id: "verify",
            title: "Verify certificate",
            subtitle: "Check a lab certificate",
            icon: "symbol:checkmark.seal",
            params: { href: "/verify-certificate" },
          },
          {
            id: "directory",
            title: "Directory",
            subtitle: "Find traders, lapidaries & labs",
            icon: "symbol:person.2",
            params: { href: "/(marketplace)/(tabs)/directory" },
          },
          {
            id: "search",
            title: "Search",
            icon: "search",
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
          "GemFort needs contacts access to import brokers, buyers, and partners from your phone.",
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
