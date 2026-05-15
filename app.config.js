// app.config.js — dynamic Expo config
// Replaces app.json so we can read environment variables at build time.
// • Local dev:  set GOOGLE_IOS_URL_SCHEME in .env.local (never commit this file)
// • EAS builds: eas env:create --scope project --name GOOGLE_IOS_URL_SCHEME --value <value> --environment production

const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME || "com.googleusercontent.apps.placeholder";

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
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,

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

      // Calendar — adding flights as calendar events
      NSCalendarsUsageDescription:
        "Logbook needs calendar access to add your flights as events.",
      NSCalendarsFullAccessUsageDescription:
        "Logbook needs full calendar access to create flight events in Apple Calendar.",

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
        appleTeamId: process.env.APPLE_TEAM_ID || "XXXXXXXXXX",
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
