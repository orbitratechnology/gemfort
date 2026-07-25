/**
 * Android-only native modules — keep them out of iOS / CocoaPods.
 * @see https://docs.expo.dev/modules/autolinking/
 */
module.exports = {
  dependencies: {
    "react-native-calllogs-android": {
      platforms: {
        ios: null,
      },
    },
  },
};
