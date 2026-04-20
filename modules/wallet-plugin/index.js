/**
 * wallet-plugin/index.js
 * Expo Config Plugin — wires up the native PassKit / WalletModule.
 *
 * What it does:
 *  1. Links PassKit.framework to the Xcode target.
 *  2. Adds WalletModule.swift to the Xcode target's Compile Sources build phase
 *     so Xcode actually compiles the native module on every build.
 *
 * NSWalletUsageDescription is intentionally omitted — PassKit does not require
 * a usage description string and Apple does not expect one.
 *
 * Usage: listed in app.json plugins array as "./modules/wallet-plugin".
 */

const { withXcodeProject } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// Source file name — must match the file in ios/FlightTracker/
const SWIFT_FILENAME = "WalletModule.swift";

/**
 * Link PassKit.framework and add WalletModule.swift to Compile Sources.
 */
function withWalletModule(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const targetName = mod.modRequest.projectName;

    // ── Find the main app target UUID ──────────────────────────────────────
    const targets = project.pbxNativeTargetSection();
    const targetEntry = Object.entries(targets).find(
      ([, t]) => t && typeof t === "object" && t.name === targetName
    );
    if (!targetEntry) {
      console.warn("[wallet-plugin] Could not find Xcode target:", targetName);
      return mod;
    }
    const [targetUUID] = targetEntry;

    // ── 1. Link PassKit.framework (skip if already linked) ────────────────
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

    // ── 2. Add WalletModule.swift to Compile Sources ───────────────────────
    // Check whether it's already referenced in the project file to avoid
    // duplicate entries on repeated prebuild runs.
    const pbxFileSection = project.pbxFileReferenceSection();
    const alreadyAdded = Object.values(pbxFileSection).some(
      (ref) =>
        ref &&
        typeof ref === "object" &&
        ref.name &&
        (ref.name === SWIFT_FILENAME ||
          ref.name === `"${SWIFT_FILENAME}"`)
    );

    if (!alreadyAdded) {
      // The Swift file lives in ios/<ProjectName>/WalletModule.swift
      const swiftFilePath = path.join(
        projectRoot,
        "ios",
        targetName,
        SWIFT_FILENAME
      );

      // Safety check — warn clearly if the file is missing rather than
      // silently producing a broken .pbxproj reference.
      if (!fs.existsSync(swiftFilePath)) {
        console.warn(
          `[wallet-plugin] WalletModule.swift not found at ${swiftFilePath}.`,
          "Make sure ios/" + targetName + "/WalletModule.swift exists before running expo prebuild."
        );
        return mod;
      }

      // addSourceFile(filePath, opts, groupName)
      // filePath is relative to the ios/<target> directory.
      project.addSourceFile(
        SWIFT_FILENAME,
        { target: targetUUID },
        targetName  // Xcode group to add the file into
      );
    }

    return mod;
  });
}

module.exports = withWalletModule;
