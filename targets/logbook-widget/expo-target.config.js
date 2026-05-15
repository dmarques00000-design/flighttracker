/**
 * expo-target.config.js
 * Config consumed by @bacons/apple-targets during `npx expo prebuild`.
 * Tells the plugin this target is a widget extension.
 *
 * NOTE: In v4, `entitlements` must be an inline object — not a file path.
 *
 * Docs: https://github.com/EvanBacon/expo-apple-targets
 */

/** @type {import('@bacons/apple-targets').AppleTargetConfig} */
module.exports = {
  type: "widget",
  name: "Logbook Widget",
  bundleIdentifier: "com.logbookapp.widget",
  deploymentTarget: "16.0",
  // Inline object — v4 no longer accepts a file path string here
  entitlements: {
    "com.apple.security.application-groups": ["group.com.logbookapp.shared"],
  },
};
