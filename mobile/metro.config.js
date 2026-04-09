// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix: "Cannot combine blockList patterns, because they have different flags"
// @shopify/react-native-skia adds a regex pattern with no flags, but Metro/Expo
// uses patterns with flags. We override blockList with consistent flags.
const { resolve } = require("path");

config.resolver.blockList = [
  /\.expo[\\/]types/,
  /(\/__tests__\/.*)$/,
  /node_modules\/.*\/skia.*xcframework\/.*/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
