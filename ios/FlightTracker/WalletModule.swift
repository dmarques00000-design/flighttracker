import ExpoModulesCore
import PassKit

// MARK: - WalletModule
//
// Registered as "FlightTrackerWallet" — matches NativeModules.FlightTrackerWallet
// in modules/WalletModule.ts.
//
// Exposes two async methods to JavaScript:
//   requestPermission()  → String  ("granted" | "denied" | "unavailable")
//   getBoardingPasses(options) → [[String: Any]]
//
// PassKit does NOT require a user permission dialog for reading passes —
// the app simply accesses PKPassLibrary directly. We return "granted"
// immediately so the JS flow works identically to the mock path.
// If PassKit is unavailable on the device we return "unavailable".

public class WalletModule: Module {

  public func definition() -> ModuleDefinition {

    // The name must match NativeModules.FlightTrackerWallet in WalletModule.ts
    Name("FlightTrackerWallet")

    // ── requestPermission ────────────────────────────────────────────────────
    // PassKit boarding-pass enumeration does not require explicit user
    // permission. We just verify PassKit is available on this device.
    AsyncFunction("requestPermission") { (promise: Promise) in
      if PKPassLibrary.isPassLibraryAvailable() {
        promise.resolve("granted")
      } else {
        promise.resolve("unavailable")
      }
    }

    // ── getBoardingPasses ────────────────────────────────────────────────────
    // Returns ALL boarding passes from the user's Wallet, including expired
    // ones. PassKit returns every pass of type .boardingPass when you call
    // passes(of:) — no relevantDate filtering happens on the native side.
    AsyncFunction("getBoardingPasses") { (options: [String: Any], promise: Promise) in
      guard PKPassLibrary.isPassLibraryAvailable() else {
        promise.resolve([[String: Any]]())
        return
      }

      let library = PKPassLibrary()
      let passes = library.passes(of: .boardingPass)

      let result: [[String: Any]] = passes.map { pass in
        WalletModule.serializePass(pass)
      }

      promise.resolve(result)
    }
  }

  // MARK: - Pass serialisation

  /// Converts a PKPass into a flat dictionary that matches the parsePKPass()
  /// function in modules/WalletModule.ts.
  ///
  /// PassKit boarding pass field keys follow the PKBoardingPass spec:
  /// https://developer.apple.com/library/archive/documentation/UserExperience/
  ///   Reference/PassKit_Bundle/Chapters/LowerLevel.html
  private static func serializePass(_ pass: PKPass) -> [String: Any] {
    var fields: [String: String] = [:]

    // Collect all localised field values from every pass field group
    let allFields: [PKPassLibrary] = [] // just for scoping
    _ = allFields

    if let boardingPass = pass.passType == .boardingPass ? pass : nil {
      // Primary fields (e.g. route)
      for field in (boardingPass.value(forKey: "primaryFields") as? [PKPassField]) ?? [] {
        if let key = field.key, let value = field.value as? String {
          fields[key] = value
        }
      }
      // Secondary fields (e.g. date, gate)
      for field in (boardingPass.value(forKey: "secondaryFields") as? [PKPassField]) ?? [] {
        if let key = field.key, let value = field.value as? String {
          fields[key] = value
        }
      }
      // Auxiliary fields
      for field in (boardingPass.value(forKey: "auxiliaryFields") as? [PKPassField]) ?? [] {
        if let key = field.key, let value = field.value as? String {
          fields[key] = value
        }
      }
      // Header fields
      for field in (boardingPass.value(forKey: "headerFields") as? [PKPassField]) ?? [] {
        if let key = field.key, let value = field.value as? String {
          fields[key] = value
        }
      }
      // Back fields
      for field in (boardingPass.value(forKey: "backFields") as? [PKPassField]) ?? [] {
        if let key = field.key, let value = field.value as? String {
          fields[key] = value
        }
      }
    }

    // Supplement fields dict with well-known PKPass properties
    // Many issuers store route in localizedDescription ("ZRH → JFK")
    if let desc = pass.localizedDescription {
      fields["localizedDescription"] = desc
    }
    if let name = pass.localizedName {
      fields["airlineName"] = name
    }
    // Organisation name often contains the airline name
    if let org = pass.value(forKey: "organizationName") as? String {
      fields["organizationName"] = org
    }
    // relevantDate is the departure date/time on most boarding passes
    if let relevantDate = pass.relevantDate {
      let df = DateFormatter()
      df.dateFormat = "yyyy-MM-dd"
      df.timeZone = TimeZone(identifier: "UTC")
      fields["date"] = df.string(from: relevantDate)

      let tf = DateFormatter()
      tf.dateFormat = "HH:mm"
      tf.timeZone = TimeZone(identifier: "UTC")
      fields["departureTime"] = tf.string(from: relevantDate)
    }

    return [
      "passTypeIdentifier": pass.passTypeIdentifier as Any,
      "serialNumber": pass.serialNumber as Any,
      "fields": fields,
    ]
  }
}
