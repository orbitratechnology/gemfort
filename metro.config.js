// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');

/** @type {import('expo/metro-config').MetroConfig} */
let config = getDefaultConfig(__dirname);

// Worklets Bundle Mode — avoids Hermes V1 legacy-eval memory blowup on Android.
// @see https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup/
config = getBundleModeMetroConfig(config);

module.exports = config;
