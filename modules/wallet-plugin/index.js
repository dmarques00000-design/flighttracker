/**
 * wallet-plugin/index.js
 * Expo Config Plugin — wires up the native PassKit / WalletModule.
 *
 * What it does:
 *  1. Adds NSWalletUsageDescription to Info.plist so iOS allows Wallet access.
 *  2. Adds PassKit.framework to the Xcode project's linked frameworks.
 *
 * Usage: listed in app.json plugins array as "./modules/wallet-plugin".
 */

const { withInfoPlist, withXcodeProject } = require("@expo/config-plugins");

/**
 * Add NSWalletUsageDescription to Info.plist.
 * Without this key the app will crash when it first accesses PKPassLibrary.
 */
function withWalletPlist(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults["NSWalletUsageDescription"] =
      mod.modResults["NSWalletUsageDescription"] ??
      "Logbook reads your boarding passes from Apple Wallet to automatically log your flights.";
    return mod;
  });
}

/**
 * Link PassKit.framework in the Xcode project.
 * expo-modules-core handles the Swift bridging header automatically;
 * we only need to ensure the system framework is linked.
 */
function withPassKit(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const targetName = mod.modRequest.projectName;

    // Find the main app target UUID
    const targets = project.pbxNativeTargetSection();
    const targetEntry = Object.entries(targets).find(
      ([, t]) => t && typeof t === "object" && t.name === targetName
    );
    if (!targetEntry) return mod;

    const [targetUUID] = targetEntry;

    // Avoid adding duplicates
    const frameworks = project.pbxFrameworksBuildPhaseObj(targetUUID);
    const alreadyLinked = (frameworks?.files ?? []).some(
      (f) => f.comment && f.comment.includes("PassKit.framework")
    );

    if (!alreadyLinked) {
      project.addFramework("PassKit.framework", {
        target: targetUUID,
        sourceTree: "SDKROOT",
        lastKnownFileType: "wrapper.framework",
      });
    }

    return mod;
  });
}

/**
 * Main plugin export.
 * Chains both modifications together.
 */
module.exports = function withWalletModule(config) {
  config = withWalletPlist(config);
  config = withPassKit(config);
  return config;
};
