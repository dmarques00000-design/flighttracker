import ExpoModulesCore
import PassKit

/// Native Expo module that bridges Apple Wallet (PassKit) boarding passes
/// to the JS layer via NativeModules.FlightTrackerWallet.
///
/// Exposed functions:
///   requestPermission()  → Promise<String>   always "granted" on iOS (PassKit needs no user prompt)
///   getBoardingPasses(options) → Promise<[[String: Any]]>   returns all PKPass boarding passes
///
/// Field mapping follows the WalletModule.ts parsePKPass() expectations so the
/// JS parser can extract flightCode, origin, destination, date, etc. without change.
public class WalletModule: Module {

  public func definition() -> ModuleDefinition {

    Name("FlightTrackerWallet")

    // ─── requestPermission ────────────────────────────────────────────────────
    // PassKit does not show a user permission dialog — PKPassLibrary is always
    // accessible on iPhone. We return "granted" immediately so the JS layer
    // can proceed to fetchBoardingPasses() without special handling.
    AsyncFunction("requestPermission") { () -> String in
      guard PKPassLibrary.isPassLibraryAvailable() else {
        return "unavailable"
      }
      return "granted"
    }

    // ─── getBoardingPasses ────────────────────────────────────────────────────
    // Returns all boarding passes from the user's Wallet, including expired ones.
    // options: { includeExpired: Bool } — currently always includes all passes
    // because PKPassLibrary.passes(of:) returns all regardless of relevantDate.
    AsyncFunction("getBoardingPasses") { (options: [String: Any]?) -> [[String: Any]] in
      guard PKPassLibrary.isPassLibraryAvailable() else {
        return []
      }

      let library = PKPassLibrary()
      let passes = library.passes(of: .boardingPass)

      return passes.compactMap { pass -> [String: Any]? in
        return WalletModule.serializePass(pass)
      }
    }
  }

  // ─── Pass serialization ─────────────────────────────────────────────────────
  /// Converts a PKPass into a dictionary that mirrors the shape expected by
  /// parsePKPass() in WalletModule.ts. We flatten all pass field groups
  /// (primaryFields, secondaryFields, auxiliaryFields, backFields, headerFields)
  /// into a single "fields" dict keyed by fieldKey so the JS mapper can probe
  /// the same keys regardless of which field group they appear in.
  private static func serializePass(_ pass: PKPass) -> [String: Any]? {
    guard let boardingPass = pass.passStructureDictionary else { return nil }

    var fields: [String: String] = [:]

    // Collect all field groups
    let groupKeys = ["primaryFields", "secondaryFields", "auxiliaryFields",
                     "backFields", "headerFields", "transitFields"]
    for groupKey in groupKeys {
      if let group = boardingPass[groupKey] as? [[String: Any]] {
        for field in group {
          if let key = field["key"] as? String,
             let value = field["value"] {
            fields[key] = "\(value)"
          }
          // Also index by label for fallback matching
          if let label = field["label"] as? String,
             let value = field["value"] {
            let normalizedLabel = label.lowercased().replacingOccurrences(of: " ", with: "")
            fields[normalizedLabel] = "\(value)"
          }
        }
      }
    }

    // Pull well-known top-level PKPass properties into fields so parsePKPass
    // can find them under consistent keys.
    fields["organizationName"] = pass.organizationName
    fields["description"] = pass.localizedDescription

    // Transit type hint — useful for filtering non-flight boarding passes
    if let transitType = boardingPass["transitType"] as? String {
      fields["transitType"] = transitType
    }

    // Relevance date → derive boarding date
    if let relevantDate = pass.relevantDate {
      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.timeZone = TimeZone(identifier: "UTC")
      fields["boardingDate"] = formatter.string(from: relevantDate)

      let timeFormatter = DateFormatter()
      timeFormatter.dateFormat = "HH:mm"
      timeFormatter.timeZone = TimeZone(identifier: "UTC")
      fields["boardingTime"] = timeFormatter.string(from: relevantDate)
    }

    return [
      "passTypeIdentifier": pass.passTypeIdentifier,
      "serialNumber": pass.serialNumber,
      "fields": fields,
    ]
  }
}
