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

  /**
   * Privacy manifest for the widget extension.
   *
   * Apple's automated scanner inspects every target in the .xcarchive
   * independently. The host app's privacyManifests in app.config.js does
   * NOT cover extension targets — each needs its own PrivacyInfo.xcprivacy.
   *
   * The file is co-located here so @bacons/apple-targets copies it into
   * the Xcode target's folder during `npx expo prebuild`.
   */
  privacyManifestPath: "./PrivacyInfo.xcprivacy",
};
