import type { NativeStackNavigationOptions } from "expo-router/react-navigation";

/**
 * Shared native-stack motion: fluid, interruptible, gesture-aligned.
 * Apple Zoom (Link.AppleZoom) layers on top for image/avatar shared elements (iOS 18+).
 * @see https://docs.expo.dev/router/advanced/zoom-transition/
 */
export const silkStackScreenOptions: NativeStackNavigationOptions = {
  // Android gets iOS-style push so both platforms feel continuous.
  animation:
    process.env.EXPO_OS === "android" ? "ios_from_right" : "default",
  animationDuration: 340,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
};
