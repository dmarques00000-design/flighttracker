import ExpoModulesCore
import PassKit
import Foundation

// MARK: - WalletModule
//
// Registered as "FlightTrackerWallet" — matches requireNativeModule("FlightTrackerWallet")
// in modules/WalletModule.ts.
//
// New Architecture (JSI) compatible: AsyncFunction closures use return values,
// not the legacy Promise argument pattern.
//
// Exposes two async methods to JavaScript:
//   requestPermission()          → String  ("granted" | "unavailable")
//   getBoardingPasses(options)   → [[String: Any]]

public class WalletModule: Module {

  public func definition() -> ModuleDefinition {

    Name("FlightTrackerWallet")

    // ── requestPermission ────────────────────────────────────────────────────
    // PassKit does NOT require a user permission dialog — PKPassLibrary is
    // always accessible on a real device. Return "granted" immediately.
    AsyncFunction("requestPermission") { () -> String in
      return PKPassLibrary.isPassLibraryAvailable() ? "granted" : "unavailable"
    }

    // ── getBoardingPasses ────────────────────────────────────────────────────
    // Returns ALL boarding passes from the user's Wallet, including expired ones.
    // PKPassLibrary.passes(of: .boardingPass) enumerates every boarding pass
    // regardless of relevantDate — no native-side filtering needed.
    AsyncFunction("getBoardingPasses") { (options: [String: Any]) -> [[String: Any]] in
      guard PKPassLibrary.isPassLibraryAvailable() else {
        return []
      }
      let library = PKPassLibrary()
      let passes = library.passes(of: .boardingPass)
      return passes.map { WalletModule.serializePass($0) }
    }
  }

  // MARK: - Pass serialisation

  /// Converts a PKPass into the flat dictionary expected by parsePKPass() in
  /// modules/WalletModule.ts.
  ///
  /// Strategy (in priority order):
  ///  1. Read pass.json from the .pkpass bundle via pass.passURL — the most
  ///     complete and reliable source of all field data.
  ///  2. Supplement with pass.localizedValue(forFieldKey:) for any keys the
  ///     JSON parse missed (handles localisation overrides).
  ///  3. Fill remaining gaps from well-known PKPass properties: relevantDate,
  ///     localizedDescription (often "ZRH → JFK"), localizedName (airline).
  private static func serializePass(_ pass: PKPass) -> [String: Any] {
    var fields: [String: String] = [:]

    // ── 1. Read pass.json from the .pkpass bundle ─────────────────────────
    // pass.passURL points to the .pkpass file on disk. We read pass.json
    // directly from the zip archive — this is the canonical, complete source
    // of all field data including backFields and non-localised values.
    if let passURL = pass.passURL {
      if let jsonData = readPassJSON(from: passURL) {
        extractFieldsFromJSON(jsonData, into: &fields)
      }
    }

    // ── 2. Named field key lookups via public API ─────────────────────────
    // localizedValue(forFieldKey:) returns localised display values for keys
    // present in the pass's currently active field groups. Fills gaps the
    // JSON parse may miss due to localisation bundles.
    let knownKeys = [
      "flightNumber", "flight", "flightCode", "flightNo",
      "origin", "departureAirport", "from",
      "destination", "arrivalAirport", "to",
      "departureCity", "originName", "originCity",
      "arrivalCity", "destinationName", "destinationCity",
      "boardingDate", "departureDate", "date",
      "departureTime", "boardingTime",
      "arrivalTime",
      "airlineCode", "carrier", "iataCode",
      "airlineName", "airline",
      "aircraft", "equipmentType", "equipment",
      "seat", "seatNumber",
      "class", "cabinClass", "serviceClass",
    ]
    for key in knownKeys {
      if let value = pass.localizedValue(forFieldKey: key), !value.isEmpty {
        fields[key] = fields[key] ?? value
      }
    }

    // ── 3. PKPass well-known properties ───────────────────────────────────

    // localizedName is the airline / organisation name
    if let name = pass.localizedName, !name.isEmpty {
      fields["airlineName"] = fields["airlineName"] ?? name
    }

    // localizedDescription is typically "ZRH → JFK" on boarding passes —
    // parse it as a fallback for origin/destination when field keys are absent.
    if let desc = pass.localizedDescription, !desc.isEmpty {
      fields["localizedDescription"] = desc
      if fields["origin"] == nil || fields["destination"] == nil {
        parseRouteFromDescription(desc, into: &fields)
      }
    }

    // relevantDate is the departure date+time on virtually all boarding passes
    if let relevantDate = pass.relevantDate {
      let dateFmt = DateFormatter()
      dateFmt.dateFormat = "yyyy-MM-dd"
      dateFmt.timeZone = TimeZone(identifier: "UTC")
      fields["date"] = fields["date"] ?? dateFmt.string(from: relevantDate)

      let timeFmt = DateFormatter()
      timeFmt.dateFormat = "HH:mm"
      timeFmt.timeZone = TimeZone(identifier: "UTC")
      fields["departureTime"] = fields["departureTime"] ?? timeFmt.string(from: relevantDate)
    }

    return [
      "passTypeIdentifier": pass.passTypeIdentifier,
      "serialNumber": pass.serialNumber,
      "fields": fields,
    ]
  }

  // MARK: - pass.json reading

  /// Read and decode pass.json from a .pkpass bundle on disk.
  /// A .pkpass file is a zip archive; on iOS PKPassLibrary extracts it to a
  /// temporary directory accessible via pass.passURL. We read pass.json
  /// directly from that directory.
  private static func readPassJSON(from passURL: URL) -> [String: Any]? {
    // Try the extracted directory first (iOS extracts .pkpass to a folder)
    let passJSONURL = passURL.appendingPathComponent("pass.json")
    if let data = try? Data(contentsOf: passJSONURL),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      return json
    }

    // Fallback: the passURL itself may be the pass.json on some iOS versions
    if let data = try? Data(contentsOf: passURL),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       json["passTypeIdentifier"] != nil {
      return json
    }

    return nil
  }

  // MARK: - JSON field extraction

  /// Walk the standard PKPass JSON structure and pull every field key/value
  /// pair into the flat fields dictionary.
  ///
  /// PKPass JSON layout:
  /// {
  ///   "organizationName": "Swiss",
  ///   "boardingPass": {
  ///     "primaryFields":   [{ "key": "origin",  "value": "ZRH" }],
  ///     "secondaryFields": [...],
  ///     "auxiliaryFields": [...],
  ///     "headerFields":    [...],
  ///     "backFields":      [...]
  ///   }
  /// }
  private static func extractFieldsFromJSON(
    _ json: [String: Any],
    into fields: inout [String: String]
  ) {
    // Top-level string scalars
    for key in ["organizationName", "description", "logoText"] {
      if let v = json[key] as? String, !v.isEmpty {
        fields[key] = v
      }
    }

    // The pass structure lives under one of these keys
    for structKey in ["boardingPass", "generic", "coupon", "eventTicket", "storeCard"] {
      guard let structure = json[structKey] as? [String: Any] else { continue }

      for groupKey in ["primaryFields", "secondaryFields", "auxiliaryFields",
                        "headerFields", "backFields"] {
        guard let fieldArray = structure[groupKey] as? [[String: Any]] else { continue }
        for fieldObj in fieldArray {
          guard let key = fieldObj["key"] as? String else { continue }
          if let value = fieldObj["value"] {
            let str: String
            if let s = value as? String { str = s }
            else if let n = value as? NSNumber { str = n.stringValue }
            else { continue }
            if !str.isEmpty { fields[key] = fields[key] ?? str }
          }
        }
      }

      // transitType hint (e.g. "PKTransitTypeAir")
      if let tt = structure["transitType"] as? String {
        fields["transitType"] = tt
      }

      break // only process the first matching structure key
    }
  }

  // MARK: - Route description parsing

  /// Attempt to extract IATA origin/destination from strings like "ZRH → JFK".
  private static func parseRouteFromDescription(
    _ desc: String,
    into fields: inout [String: String]
  ) {
    let separators = [" → ", " > ", " - ", "-", "/"]
    let iataRegex = try? NSRegularExpression(pattern: "^[A-Z]{3}$")

    for sep in separators {
      let parts = desc.components(separatedBy: sep)
      guard parts.count == 2 else { continue }
      let a = parts[0].trimmingCharacters(in: .whitespaces)
      let b = parts[1].trimmingCharacters(in: .whitespaces)
      let isIATA: (String) -> Bool = { s in
        iataRegex?.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
      }
      if isIATA(a) && isIATA(b) {
        fields["origin"] = fields["origin"] ?? a
        fields["destination"] = fields["destination"] ?? b
      }
      break
    }
  }
}
