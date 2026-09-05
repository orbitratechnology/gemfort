import type { ConfigContext, ExpoConfig } from "expo/config";

const env = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

// All EAS environments use the same native app and Firebase configuration.
const bundleId = "app.gemfort";

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
        // android: {
        //   enableProguardInReleaseBuilds: true,
        //   enableShrinkResourcesInReleaseBuilds: true,
        // },
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
        },
        // Static iOS actions available before JS loads; replaced dynamically by role.
        // Prefer outline SF Symbols / built-ins so they match system menu icons.
        iosActions: [
          {
            id: "certificate-portals",
            title: "Certificate portals",
            subtitle: "Open external verification pages",
            icon: "symbol:link",
            params: { href: "/verify-certificate-portals" },
          },
          {
            id: "market",
            title: "Market",
            subtitle: "Find traders and lapidaries",
            icon: "symbol:person.2",
            params: { href: "/(marketplace)/(tabs)/market" },
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
