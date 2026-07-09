import type { ConfigContext, ExpoConfig } from 'expo/config';

const env = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

const bundleIds: Record<string, string> = {
  development: 'app.gemfort.dev',
  preview: 'app.gemfort.preview',
  production: 'app.gemfort',
};

const bundleId = bundleIds[env] ?? bundleIds.development;

/** Single Firebase project (gemfort); native config files differ per EAS bundle ID. */
const googleServicesSuffix =
  env === 'production' ? '' : env === 'preview' ? '.preview' : '.dev';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GemFort',
  slug: 'gemfort',
  version: '1.0.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gemfort',
  userInterfaceStyle: 'automatic',
  buildCacheProvider: 'eas',
  updates: {
    url: 'https://u.expo.dev/4ef3ea53-839b-47a2-9621-2875c6fa182d',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains:
      env === 'production' || env === 'preview'
        ? ['applinks:gemfort.app']
        : [],
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ??
      `./google-services/GoogleService-Info${googleServicesSuffix}.plist`,
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: '#1A3A5C',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services/google-services.json',
    intentFilters:
      env === 'production' || env === 'preview'
        ? [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [
                {
                  scheme: 'https',
                  host: 'gemfort.app',
                  pathPrefix: '/l',
                },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ]
        : [],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-vector-icons/material-icons',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBFirestore', 'RNFBStorage'],
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#1A3A5C',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#1A3A5C',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'GemFort needs photo access to upload gem images.',
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
      projectId: '4ef3ea53-839b-47a2-9621-2875c6fa182d',
    },
    appEnv: env,
  },
  owner: 'orbitratech',
});
