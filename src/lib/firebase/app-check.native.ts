import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';

let appCheckInstance: AppCheck | null = null;
let initializePromise: Promise<void> | null = null;

function isProductionBuild(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV === 'production';
}

function getConfiguredAppCheck(): AppCheck {
  if (appCheckInstance) return appCheckInstance;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: {
      provider: isProductionBuild() ? 'playIntegrity' : 'debug',
    },
    apple: {
      provider: isProductionBuild()
        ? 'appAttestWithDeviceCheckFallback'
        : 'debug',
    },
  });

  appCheckInstance = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  return appCheckInstance;
}

/**
 * Register the native provider before Firestore/Auth-backed UI mounts.
 *
 * App Check's native provider configuration is asynchronous internally. The
 * token accessor below retries once to cover that short initialization window.
 */
export function initializeFirebaseAppCheck(): Promise<void> {
  if (!initializePromise) {
    initializePromise = Promise.resolve()
      .then(() => {
        getConfiguredAppCheck();
      })
      .catch((error) => {
        initializePromise = null;
        appCheckInstance = null;
        throw error;
      });
  }

  return initializePromise;
}

function waitForNativeProvider(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

export async function getFirebaseAppCheckToken(): Promise<string | null> {
  try {
    await initializeFirebaseAppCheck();
    const appCheck = getConfiguredAppCheck();

    try {
      return (await getToken(appCheck, false)).token || null;
    } catch {
      await waitForNativeProvider();
      return (await getToken(appCheck, false)).token || null;
    }
  } catch {
    return null;
  }
}
