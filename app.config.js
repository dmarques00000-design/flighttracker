// app.config.js — dynamic Expo config
// Replaces app.json so we can read environment variables at build time.
//
// Local dev:
//   Copy .env.local.example → .env.local and fill in real values.
//   Never commit .env.local — it is git-ignored.
//
// EAS builds:
//   Store secrets with:
//     eas secret:create --scope project --name APPLE_TEAM_ID --value <id> --environment production
//     eas secret:create --scope project --name GOOGLE_IOS_URL_SCHEME --value <scheme> --environment production
//   Both variables must exist in every EAS environment that produces
//   an iOS build. A missing value throws at config-evaluation time so
//   the build fails fast with an actionable message instead of
//   silently embedding a placeholder and failing at codesign/archive.

const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";

// GOOGLE_IOS_URL_SCHEME
// Required for production; a placeholder is acceptable in dev/preview
// because the Google Sign-In redirect only needs to work in real builds.
const googleIosUrlScheme = IS_PRODUCTION
  ? (() => {
      const v = process.env.GOOGLE_IOS_URL_SCHEME;
      if (!v)
        throw new Error(
          "[app.config.js] GOOGLE_IOS_URL_SCHEME is not set.\n" +
          "Run: eas secret:create --scope project --name GOOGLE_IOS_URL_SCHEME --value <your-value> --environment production"
        );
      return v;
    })()
  : process.env.GOOGLE_IOS_URL_SCHEME || "com.googleusercontent.apps.placeholder";

// APPLE_TEAM_ID
// Required in every environment that builds an iOS binary.
// A placeholder team ID produces a binary that passes local Expo
// validation but fails at EAS codesigning or Xcode archive with a
// cryptic "team not found" error — always fail fast here instead.
const appleTeamId = (() => {
  const v = process.env.APPLE_TEAM_ID;
  if (!v)
    throw new Error(
      "[app.config.js] APPLE_TEAM_ID is not set.\n" +
      "For local builds:   add APPLE_TEAM_ID=<10-char-id> to .env.local\n" +
      "For EAS builds:     eas secret:create --scope project --name APPLE_TEAM_ID --value <10-char-id> --environment production"
    );
  if (!/^[A-Z0-9]{10}$/.test(v))
    throw new Error(
      `[app.config.js] APPLE_TEAM_ID looks wrong: "${v}"\n` +
      "Apple Team IDs are exactly 10 uppercase alphanumeric characters (e.g. AB12CD34EF)."
    );
  return v;
})();

// App Group shared between the main app and the widget extension.
const APP_GROUP = "group.com.logbookapp.shared";

// Test account banner is shown in development and preview builds only.
// Never set SHOW_TEST_ACCOUNT in the production EAS profile.
const showTestAccount = process.env.SHOW_TEST_ACCOUNT === "true";

/** @type {import('expo/config').ExpoConfig} */
export default {
  name: "Logbook",
  slug: "logbook",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "logbook",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#F7F6F2",
    dark: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0F",
    },
  },

  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.logbookapp",
    buildNumber: "1",
    usesAppleSignIn: true,

    // Minimum supported iOS version.
    // 16.0 is required because:
    //   - NSCalendarsFullAccessUsageDescription is an iOS 17+ key but the
    //     Calendar framework changes that introduced the read/write split
    //     shipped with iOS 16's public API surface.
    //   - expo-apple-authentication and PassKit wallet entitlements target
    //     iOS 16.0 as their effective floor.
    //   - Keeps the widest possible audience while guaranteeing all runtime
    //     APIs (EventKit, PassKit, AuthenticationServices) are available.
    deploymentTarget: "16.0",

    entitlements: {
      "com.apple.security.application-groups": [APP_GROUP],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],

      // ---------------------------------------------------------------------------
      // NSPrivacyCollectedDataTypes — App Store Nutrition Label (§5.1.2)
      //
      // MUST match exactly what the app collects AND what privacy.html §2 states.
      // A mismatch between this manifest, the human-readable policy, and the
      // App Store Connect nutrition label form is a direct §5.1.2 rejection reason.
      //
      // Rule of thumb for each entry:
      //   Linked   = true  when the data is stored server-side tied to the user ID.
      //   Tracking = false for all entries — no ad/analytics SDK is used.
      //   Purposes = AppFunctionality for everything here.
      // ---------------------------------------------------------------------------
      NSPrivacyCollectedDataTypes: [
        {
          // Email address — account creation / sign-in (Apple, Google, email).
          // Stored server-side linked to the user record.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Display name — shown in profile, sent with feedback submissions.
          // Stored server-side linked to the user record.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Coarse location — one-shot request to suggest the nearest airport
          // when adding a flight. Never stored or transmitted beyond the
          // single in-session lookup; result is discarded after suggestion.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCoarseLocation",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Other user content — covers:
          //   • Flight log entries (code, route, date, airline, seat class,
          //     duration, distance) stored server-side when signed in.
          //   • Trip names and groupings.
          //   • Free-text feedback messages submitted via FeedbackModal.
          // Not linked to a persistent identifier beyond session auth;
          // feedback is stored without a user ID on the server.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Photos or videos — cover images the user selects from their
          // photo library for trip cards. The chosen image is stored locally
          // and optionally uploaded when sharing a trip card. Never accessed
          // without explicit user action (photo picker).
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosOrVideos",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Other data types — optional profile preference fields the user
          // may choose to enter: nationality, home airport code, frequent
          // flyer number, preferred airline, seat preference.
          // All stored locally in AsyncStorage; synced server-side only
          // when the user is signed in. None are required.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherDataTypes",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
      ],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,

      // §2.3.3 — iPhone-only declaration.
      UIDeviceFamily: [1],
      UIRequiredDeviceCapabilities: ["arm64", "telephony"],

      // Camera — boarding pass / QR code scanning
      NSCameraUsageDescription:
        "Logbook uses the camera to scan boarding passes and QR codes to import your flights automatically.",

      // Photo library read — choosing cover images for trips
      NSPhotoLibraryUsageDescription:
        "Logbook accesses your photo library so you can set a cover image for your trips.",

      // Photo library write — saving shareable flight cards
      NSPhotoLibraryAddUsageDescription:
        "Logbook saves shareable flight cards to your photo library.",

      // Location — suggesting nearest airport
      NSLocationWhenInUseUsageDescription:
        "Logbook uses your location to suggest your nearest airport when adding a flight.",

      // Calendar — iOS 16 and earlier (legacy key, kept for backwards compatibility)
      NSCalendarsUsageDescription:
        "Logbook needs calendar access to scan for flights and add flight events to Apple Calendar.",

      // Calendar — iOS 17+ read/write split permissions
      NSCalendarsFullAccessUsageDescription:
        "Logbook needs full calendar access to scan your existing events for flight codes and to add new flight events to Apple Calendar.",
      NSCalendarsWriteOnlyAccessUsageDescription:
        "Logbook needs calendar write access to add your flights as events in Apple Calendar.",

      // Contacts — §5.1.2 defensive declaration.
      NSContactsUsageDescription:
        "Logbook may access your contacts only if you choose to share them when sending feedback.",

      // Survey — §5.1.2 defensive declaration.
      NSSurveyUsageDescription:
        "Logbook uses in-app feedback to help improve the app. No survey data is shared with third parties.",

      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: "Boarding Pass",
          CFBundleTypeRole: "Viewer",
          LSHandlerRank: "Alternate",
          LSItemContentTypes: ["com.apple.pkpass", "com.apple.pkpasses"],
          CFBundleTypeIconFiles: [],
        },
      ],
      UTImportedTypeDeclarations: [
        {
          UTTypeIdentifier: "com.apple.pkpass",
          UTTypeDescription: "Apple Wallet Pass",
          UTTypeConformsTo: ["public.data", "public.zip-based"],
          UTTypeTagSpecification: {
            "public.filename-extension": ["pkpass"],
            "public.mime-type": "application/vnd.apple.pkpass",
          },
        },
        {
          UTTypeIdentifier: "com.apple.pkpasses",
          UTTypeDescription: "Apple Wallet Passes Bundle",
          UTTypeConformsTo: ["public.data", "public.zip-based"],
          UTTypeTagSpecification: {
            "public.filename-extension": ["pkpasses"],
            "public.mime-type": "application/vnd.apple.pkpasses",
          },
        },
      ],
    },
  },

  web: {
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-apple-authentication",
    "expo-calendar",
    "expo-document-picker",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: googleIosUrlScheme,
      },
    ],
    // Widget extension — reads Swift sources from targets/logbook-widget/
    [
      "@bacons/apple-targets",
      {
        appleTeamId,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  android: {
    package: "com.logbookapp",
  },

  extra: {
    showTestAccount,
    router: {},
    eas: {
      projectId: "358b4684-35f7-49ac-b34a-2c72bcd425d0",
    },
  },
};
