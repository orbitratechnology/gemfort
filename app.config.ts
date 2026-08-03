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
      `./google-services/google-services${googleServicesSuffix}.json`,
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
    "expo-apple-authentication",
    "react-native-nitro-google-signin",
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
        // String icons = non-adaptive (transparent, no colored plate).
        // *_light = black glyph, *_dark = white glyph; JS picks via useColorScheme.
        // Regenerate: python scripts/generate-shortcut-icons.py
        androidIcons: {
          shortcut_verify_light:
            "./assets/images/shortcuts/shortcut_verify_light.png",
          shortcut_verify_dark:
            "./assets/images/shortcuts/shortcut_verify_dark.png",
          shortcut_gem_light:
            "./assets/images/shortcuts/shortcut_gem_light.png",
          shortcut_gem_dark: "./assets/images/shortcuts/shortcut_gem_dark.png",
          shortcut_add_light:
            "./assets/images/shortcuts/shortcut_add_light.png",
          shortcut_add_dark: "./assets/images/shortcuts/shortcut_add_dark.png",
          shortcut_ap_light: "./assets/images/shortcuts/shortcut_ap_light.png",
          shortcut_ap_dark: "./assets/images/shortcuts/shortcut_ap_dark.png",
          shortcut_cheque_light:
            "./assets/images/shortcuts/shortcut_cheque_light.png",
          shortcut_cheque_dark:
            "./assets/images/shortcuts/shortcut_cheque_dark.png",
          shortcut_service_light:
            "./assets/images/shortcuts/shortcut_service_light.png",
          shortcut_service_dark:
            "./assets/images/shortcuts/shortcut_service_dark.png",
          shortcut_jobs_light:
            "./assets/images/shortcuts/shortcut_jobs_light.png",
          shortcut_jobs_dark:
            "./assets/images/shortcuts/shortcut_jobs_dark.png",
          shortcut_contacts_light:
            "./assets/images/shortcuts/shortcut_contacts_light.png",
          shortcut_contacts_dark:
            "./assets/images/shortcuts/shortcut_contacts_dark.png",
          shortcut_bill_light:
            "./assets/images/shortcuts/shortcut_bill_light.png",
          shortcut_bill_dark:
            "./assets/images/shortcuts/shortcut_bill_dark.png",
          shortcut_certificates_light:
            "./assets/images/shortcuts/shortcut_certificates_light.png",
          shortcut_certificates_dark:
            "./assets/images/shortcuts/shortcut_certificates_dark.png",
          shortcut_money_light:
            "./assets/images/shortcuts/shortcut_money_light.png",
          shortcut_money_dark:
            "./assets/images/shortcuts/shortcut_money_dark.png",
          shortcut_market_light:
            "./assets/images/shortcuts/shortcut_market_light.png",
          shortcut_market_dark:
            "./assets/images/shortcuts/shortcut_market_dark.png",
          shortcut_search_light:
            "./assets/images/shortcuts/shortcut_search_light.png",
          shortcut_search_dark:
            "./assets/images/shortcuts/shortcut_search_dark.png",
          shortcut_news_light:
            "./assets/images/shortcuts/shortcut_news_light.png",
          shortcut_news_dark:
            "./assets/images/shortcuts/shortcut_news_dark.png",
        },
        // Static iOS actions available before JS loads; replaced dynamically by role.
        // Prefer outline SF Symbols / built-ins so they match system menu icons.
        iosActions: [
          {
            id: "verify",
            title: "Verify certificate",
            subtitle: "Check a lab certificate",
            icon: "symbol:checkmark.seal",
            params: { href: "/verify-certificate" },
          },
          {
            id: "market",
            title: "Market",
            subtitle: "Find traders, lapidaries & labs",
            icon: "symbol:person.2",
            params: { href: "/(marketplace)/(tabs)/market" },
          },
          {
            id: "news",
            title: "Gem news",
            icon: "symbol:newspaper",
            params: { href: "/news" },
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
