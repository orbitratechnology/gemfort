import type { Href } from 'expo-router';

/** Cast dynamic route strings for Expo Router typed routes. */
export function appHref(path: string): Href {
  return path as Href;
}
