/**
 * expo-target.config.js
 * Config consumed by expo-apple-targets during `npx expo prebuild`.
 * Tells the plugin this target is a widget extension.
 *
 * Docs: https://github.com/EvanBacon/expo-apple-targets
 */

/** @type {import('expo-apple-targets').AppleTargetConfig} */
module.exports = {
  type: "widget",
  name: "Logbook Widget",
  bundleIdentifier: "com.logbookapp.widget",
  deploymentTarget: "16.0",
  // The entitlements file next to this config
  entitlements: "LogbookWidget.entitlements",
};
