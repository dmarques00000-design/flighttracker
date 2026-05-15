/**
 * expo-target.config.js
 * Config consumed by @bacons/apple-targets during `npx expo prebuild`.
 * Tells the plugin this target is a widget extension.
 *
 * NOTE: The folder name (LogbookWidget) becomes the Xcode target name.
 * It must match the name used in provisioning profiles.
 *
 * Docs: https://github.com/EvanBacon/expo-apple-targets
 */

/** @type {import('@bacons/apple-targets').AppleTargetConfig} */
module.exports = {
  type: "widget",
  name: "LogbookWidget",
  bundleIdentifier: "com.logbookapp.widget",
  deploymentTarget: "16.0",
  // Inline object — v4 no longer accepts a file path string here
  entitlements: {
    "com.apple.security.application-groups": ["group.com.logbookapp.shared"],
  },
};
