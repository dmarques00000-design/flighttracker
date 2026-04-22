// app.config.js — dynamic Expo config
// Replaces app.json so we can read environment variables at build time.
// • Local dev:  set GOOGLE_IOS_URL_SCHEME in .env.local (never commit this file)
// • EAS builds: store as an EAS secret
//   `eas secret:create --scope project --name GOOGLE_IOS_URL_SCHEME --value <value>`

const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

if (!googleIosUrlScheme) {
  throw new Error(
    "[app.config.js] Missing required env var: GOOGLE_IOS_URL_SCHEME\n" +
    "  • Local dev: add it to .env.local\n" +
    "  • EAS builds: run `eas secret:create --scope project --name GOOGLE_IOS_URL_SCHEME --value <value>`"
  );
}

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
    backgroundColor: "#0A0A0F",
  },

  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.logbookapp",
    buildNumber: "1",
    usesAppleSignIn: true,
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["DDA9.1"],
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
    [
      "@react-native-google-signin/google-signin",
      {
        // Injected at build time — never hardcoded in source
        iosUrlScheme: googleIosUrlScheme,
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
    router: {},
    eas: {
      projectId: "358b4684-35f7-49ac-b34a-2c72bcd425d0",
    },
  },
};
