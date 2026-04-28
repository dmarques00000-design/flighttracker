/**
 * +native-intent.tsx
 *
 * Handles files opened from other apps (share sheet, Files app, etc.).
 * When iOS forwards a .pkpass file to Logbook, this redirects to the
 * wallet-import screen which will pick up the file from the incoming URL.
 *
 * Expo Router calls redirectSystemPath() for every incoming native intent
 * (file open, universal link, custom URL scheme, etc.).
 */

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  // If the OS is opening a .pkpass file into the app, send the user
  // straight to the wallet-import screen.  The file URI is in `path`.
  if (path && path.toLowerCase().includes(".pkpass")) {
    // Encode the file URI as a query param so wallet-import can read it
    const encoded = encodeURIComponent(path);
    return `/wallet-import?pkpassUri=${encoded}`;
  }

  // Default: always land on the home tab
  return "/";
}
