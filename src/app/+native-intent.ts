/**
 * Rewrite OS share intents / extensions into an in-app route.
 * @see https://docs.expo.dev/router/advanced/native-intent/
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
 */
export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const url = new URL(path, 'gemfort://');
    if (url.hostname === 'expo-sharing') {
      return '/handle-share';
    }
    return path;
  } catch {
    return path;
  }
}
