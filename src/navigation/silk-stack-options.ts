/**
 * Shared native-stack motion: fluid, interruptible, gesture-aligned.
 * Apple Zoom (Link.AppleZoom) layers on top for image/avatar shared elements (iOS 18+).
 * @see https://docs.expo.dev/router/advanced/zoom-transition/
 */
export const silkStackScreenOptions = {
  // Android gets iOS-style push so both platforms feel continuous.
  animation:
    process.env.EXPO_OS === "android"
      ? ("ios_from_right" as const)
      : ("default" as const),
  animationDuration: 340,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
};

/**
 * Bottom-sheet presentation.
 * Present from a stack ABOVE NativeTabs (not inside a tab stack).
 * @see https://docs.expo.dev/router/advanced/modals/#form-sheet-presentation
 */
export const formSheetScreenOptions = {
  presentation: "formSheet" as const,
  headerShown: false,
  sheetAllowedDetents: [0.55, 1] as number[],
  sheetInitialDetentIndex: "last" as const,
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  gestureEnabled: true,
  fullScreenGestureEnabled: false,
};

/**
 * Compact sheet sized to content (`fitToContents`).
 * Do not use `flex: 1` on the screen root — the sheet measures intrinsic height.
 */
export const formSheetFitContentOptions = {
  ...formSheetScreenOptions,
  sheetAllowedDetents: "fitToContents" as const,
  sheetInitialDetentIndex: 0 as const,
};
