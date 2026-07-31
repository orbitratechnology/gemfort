import type { ConfigContext, ExpoConfig } from "expo/config";

const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

const value = (key: string, fallback: string) => process.env[key] ?? fallback;

const appName = value("EXPO_PUBLIC_APP_NAME", "Expo Firebase Template");
const appSlug = value("EXPO_PUBLIC_APP_SLUG", "expo-firebase-template");
const appScheme = value("EXPO_PUBLIC_APP_SCHEME", "expofirebase");
const bundleIdBase = value("EXPO_PUBLIC_BUNDLE_ID_BASE", "com.example.expofirebase");
const associatedDomain = process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN;

const bundleIdByEnv: Record<string, string> = {
  development: `${bundleIdBase}.dev`,
  preview: `${bundleIdBase}.preview`,
  production: bundleIdBase,
};

const bundleId = bundleIdByEnv[appEnv] ?? bundleIdByEnv.development;

const googleServicesSuffix =
  appEnv === "production" ? "" : appEnv === "preview" ? ".preview" : ".dev";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug: appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: appScheme,
  userInterfaceStyle: "automatic",
  updates: {
    enabled: true,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  ios: {
    icon: "./assets/app-icon.icon",
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: associatedDomain
      ? [
          `applinks:${associatedDomain}`,
        ]
      : [],
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ??
      `./google-services/GoogleService-Info${googleServicesSuffix}.plist`,
  },
  android: {
    package: bundleId,
    softwareKeyboardLayoutMode: "pan",
    adaptiveIcon: {
      backgroundColor: "#000000",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    icon: "./assets/images/icon.png",
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      `./google-services/google-services${googleServicesSuffix}.json`,
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-secure-store",
    "expo-notifications",
    "expo-image-picker",
    "expo-contacts",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          forceStaticLinking: ["RNFBApp", "RNFBAuth", "RNFBFirestore", "RNFBStorage"],
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
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
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
    appEnv,
  },
  owner: process.env.EXPO_PUBLIC_EAS_OWNER,
});
