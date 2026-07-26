const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Pin native modules to the project root copy. Nested installs under
// expo-router/node_modules (etc.) make Metro load two JS copies, which
// double-registers view managers like RNSScreen and crashes on launch.
const rootNodeModules = path.resolve(__dirname, "node_modules");
for (const name of [
  "react-native-screens",
  "react-native-safe-area-context",
  "react-native-gesture-handler",
  "react-native-reanimated",
]) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    [name]: path.join(rootNodeModules, name),
  };
}

module.exports = config;
