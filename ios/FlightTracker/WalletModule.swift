import ExpoModulesCore
import PassKit

// MARK: - WalletModule
//
// Registered as "FlightTrackerWallet" — matches NativeModules.FlightTrackerWallet
// in modules/WalletModule.ts.
//
// Exposes two async methods to JavaScript:
//   requestPermission()          → String  ("granted" | "unavailable")
//   getBoardingPasses(options)   → [[String: Any]]
//
// PassKit does NOT require a user permission dialog for reading passes —
// PKPassLibrary is accessible as long as the app is installed on a real device.
// We return "granted" immediately so the JS flow works identically to the mock path.

public class WalletModule: Module {

  public func definition() -> ModuleDefinition {

    Name("FlightTrackerWallet")

    // ── requestPermission ────────────────────────────────────────────────────
    AsyncFunction("requestPermission") { (promise: Promise) in
      if PKPassLibrary.isPassLibraryAvailable() {
        promise.resolve("granted")
      } else {
        promise.resolve("unavailable")
      }
    }

    // ── getBoardingPasses ────────────────────────────────────────────────────
    // Returns ALL boarding passes from the user's Wallet, including expired ones.
    // PKPassLibrary.passes(of: .boardingPass) enumerates every boarding pass
    // regardless of relevantDate — no native-side filtering.
    AsyncFunction("getBoardingPasses") { (options: [String: Any], promise: Promise) in
      guard PKPassLibrary.isPassLibraryAvailable() else {
        promise.resolve([[String: Any]]())
        return
      }

      let library = PKPassLibrary()
      let passes = library.passes(of: .boardingPass)
      let result: [[String: Any]] = passes.map { WalletModule.serializePass($0) }
      promise.resolve(result)
    }
  }

  // MARK: - Pass serialisation

  /// Converts a PKPass into the flat dictionary expected by parsePKPass() in
  /// modules/WalletModule.ts.
  ///
  /// Strategy:
  ///  1. Walk every PKPassField in every field group via the public
  ///     PKPass.localizedValue(forFieldKey:) API — this is the only reliable
  ///     way to read field values without private KVC.
  ///  2. Supplement with well-known PKPass properties (relevantDate,
  ///     localizedDescription, localizedName) that carriers reliably populate.
  ///  3. Attempt to parse the raw pass.json bundle for any remaining keys
  ///     (flightNumber, origin, destination, etc.) that issuers embed there
  ///     but don't surface through a named field key.
  private static func serializePass(_ pass: PKPass) -> [String: Any] {
    var fields: [String: String] = [:]

    // ── 1. Walk pass JSON bundle ──────────────────────────────────────────
    // PKPass exposes its underlying JSON via the `passURL` file package.
    // The most portable approach is to read the pass data directly from the
    // PKPass object's json representation.
    if let passData = pass.value(forKey: "data") as? Data,
       let json = try? JSONSerialization.jsonObject(with: passData) as? [String: Any] {
      extractFieldsFromJSON(json, into: &fields)
    }

    // ── 2. Named field key lookups (public API) ───────────────────────────
    // Common field keys used by major airlines. We try each and take the
    // first non-nil, non-empty value.
    let knownKeys = [
      "flightNumber", "flight", "flightCode", "flightNo",
      "origin", "departureAirport", "from", "boardingGate", "gate",
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

    // localizedDescription on boarding passes is typically "ZRH → JFK"
    if let desc = pass.localizedDescription, !desc.isEmpty {
      fields["localizedDescription"] = desc
      // If we still lack origin/destination, try to parse "AAA → BBB" or "AAA-BBB"
      if fields["origin"] == nil || fields["destination"] == nil {
        let separators = [" → ", " > ", " - ", "-", "/"]
        for sep in separators {
          let parts = desc.components(separatedBy: sep)
          if parts.count == 2 {
            let a = parts[0].trimmingCharacters(in: .whitespaces)
            let b = parts[1].trimmingCharacters(in: .whitespaces)
            // Only treat as IATA if 3 uppercase letters
            let iataPattern = try? NSRegularExpression(pattern: "^[A-Z]{3}$")
            let aIsIATA = iataPattern?.firstMatch(in: a, range: NSRange(a.startIndex..., in: a)) != nil
            let bIsIATA = iataPattern?.firstMatch(in: b, range: NSRange(b.startIndex..., in: b)) != nil
            if aIsIATA && bIsIATA {
              fields["origin"] = fields["origin"] ?? a
              fields["destination"] = fields["destination"] ?? b
            }
            break
          }
        }
      }
    }

    // localizedName is the airline / organisation name
    if let name = pass.localizedName, !name.isEmpty {
      fields["airlineName"] = fields["airlineName"] ?? name
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

  // MARK: - JSON bundle field extraction

  /// Walk the standard PKPass JSON structure and pull every field key/value
  /// pair into the flat fields dictionary.
  ///
  /// PKPass JSON layout (relevant parts):
  /// {
  ///   "organizationName": "Swiss",
  ///   "boardingPass": {                  ← or "generic", "coupon", etc.
  ///     "primaryFields":   [{ "key": "origin", "value": "ZRH", ... }],
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
    // Top-level string values
    let topLevelKeys = ["organizationName", "description", "logoText"]
    for key in topLevelKeys {
      if let v = json[key] as? String, !v.isEmpty {
        fields[key] = v
      }
    }

    // The boarding pass structure can live under different keys
    let structureKeys = ["boardingPass", "generic", "coupon", "eventTicket", "storeCard"]
    for structKey in structureKeys {
      guard let structure = json[structKey] as? [String: Any] else { continue }
      let groupKeys = ["primaryFields", "secondaryFields", "auxiliaryFields",
                       "headerFields", "backFields", "transitType"]
      for groupKey in groupKeys {
        guard let fieldArray = structure[groupKey] as? [[String: Any]] else { continue }
        for fieldObj in fieldArray {
          if let key = fieldObj["key"] as? String {
            // Prefer the raw value; fall back to label for display-only fields
            if let value = fieldObj["value"] {
              let str: String
              if let s = value as? String { str = s }
              else if let n = value as? NSNumber { str = n.stringValue }
              else { continue }
              if !str.isEmpty { fields[key] = fields[key] ?? str }
            }
          }
        }
      }
      break // only process the first matching structure key
    }
  }
}
