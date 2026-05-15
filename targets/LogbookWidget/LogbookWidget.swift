//
// LogbookWidget.swift
// Logbook — iOS home screen widget
//
// Two widget variants:
//   • Small  — NextFlightWidget  : "Next flight: LIS → GVA · Tomorrow 07:20 · T2"
//   • Medium — MonthRecapWidget  : month recap (flights, miles, top route, CO₂)
//
// Data is written by the React Native app via App Group UserDefaults
// (key: logbook_next_flight / logbook_month_recap) every time the
// flights array changes. See utils/widgetData.ts.
//
// App Group: group.com.logbookapp.shared
// Deployment target: iOS 16+
//

import WidgetKit
import SwiftUI

// MARK: - Shared colours (match Logbook accent #01696f)

fileprivate extension Color {
    static let accent    = Color(red: 0.004, green: 0.412, blue: 0.435)
    static let accentDim = Color(red: 0.004, green: 0.412, blue: 0.435).opacity(0.12)
    static let textSec   = Color(white: 0.45)
    static let cardBg    = Color(UIColor.secondarySystemBackground)
}

// MARK: - App Group

fileprivate let appGroup = "group.com.logbookapp.shared"
fileprivate let defaults = UserDefaults(suiteName: appGroup)

// MARK: - Data models (must mirror utils/widgetData.ts)

struct NextFlightData: Codable {
    let flightCode: String
    let departureAirport: String
    let arrivalAirport: String
    let date: String          // "yyyy-MM-dd"
    let departureTime: String // "HH:mm"
    let departureTerminal: String?
    let departureGate: String?
    let airline: String
}

struct MonthRecapData: Codable {
    let monthLabel: String
    let flightCount: Int
    let miles: Int
    let topRoute: String?
    let co2Kg: Int
}

// MARK: - Convenience loaders

fileprivate func loadNextFlight() -> NextFlightData? {
    guard
        let json = defaults?.string(forKey: "logbook_next_flight"),
        let data = json.data(using: .utf8),
        let decoded = try? JSONDecoder().decode(NextFlightData?.self, from: data)
    else { return nil }
    return decoded
}

fileprivate func loadMonthRecap() -> MonthRecapData {
    if
        let json = defaults?.string(forKey: "logbook_month_recap"),
        let data = json.data(using: .utf8),
        let decoded = try? JSONDecoder().decode(MonthRecapData.self, from: data)
    { return decoded }
    // Placeholder when no data written yet
    let label = Date().formatted(.dateTime.month(.wide).year())
    return MonthRecapData(monthLabel: label, flightCount: 0, miles: 0, topRoute: nil, co2Kg: 0)
}

// MARK: - Date helpers

fileprivate func relativeDay(_ isoDate: String) -> String {
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    guard let date = fmt.date(from: isoDate) else { return isoDate }
    let cal = Calendar.current
    if cal.isDateInToday(date)    { return "Today" }
    if cal.isDateInTomorrow(date) { return "Tomorrow" }
    if let diff = cal.dateComponents([.day], from: Date(), to: date).day, diff < 7 {
        let wfmt = DateFormatter()
        wfmt.dateFormat = "EEEE"
        return wfmt.string(from: date)
    }
    let dfmt = DateFormatter()
    dfmt.dateFormat = "d MMM"
    return dfmt.string(from: date)
}

// MARK: - SMALL WIDGET — Next Flight

struct NextFlightEntry: TimelineEntry {
    let date: Date
    let flight: NextFlightData?
}

struct NextFlightProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextFlightEntry {
        NextFlightEntry(date: .now, flight: NextFlightData(
            flightCode: "TP1962",
            departureAirport: "LIS",
            arrivalAirport: "GVA",
            date: ISO8601DateFormatter().string(from: Date()).prefix(10).description,
            departureTime: "07:20",
            departureTerminal: "1",
            departureGate: "A14",
            airline: "TAP Air Portugal"
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (NextFlightEntry) -> Void) {
        completion(NextFlightEntry(date: .now, flight: loadNextFlight()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextFlightEntry>) -> Void) {
        let entry = NextFlightEntry(date: .now, flight: loadNextFlight())
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextFlightWidgetView: View {
    let entry: NextFlightEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var scheme

    var body: some View {
        if let f = entry.flight {
            flightView(f)
        } else {
            emptyView
        }
    }

    @ViewBuilder
    private func flightView(_ f: NextFlightData) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.accent)
                Text("Next flight")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.accent)
            }
            .padding(.bottom, 8)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(f.departureAirport)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.textSec)
                Text(f.arrivalAirport)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
            }
            .padding(.bottom, 4)

            HStack(spacing: 6) {
                Text(f.flightCode)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.textSec)
                Circle()
                    .frame(width: 3, height: 3)
                    .foregroundStyle(Color.textSec)
                Text(relativeDay(f.date))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textSec)
            }
            .padding(.bottom, 6)

            Spacer(minLength: 0)

            HStack(spacing: 0) {
                Label(f.departureTime, systemImage: "clock")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)

                if let terminal = f.departureTerminal {
                    Text(" · T")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSec)
                    + Text(terminal)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.primary)
                }

                if let gate = f.departureGate {
                    Text(" · Gate ")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSec)
                    + Text(gate)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.primary)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.cardBg)
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "airplane")
                .font(.system(size: 28))
                .foregroundStyle(Color.accent)
            Text("No upcoming\nflights")
                .font(.system(size: 13, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.textSec)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.cardBg)
    }
}

struct NextFlightWidget: Widget {
    let kind = "NextFlightWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextFlightProvider()) { entry in
            NextFlightWidgetView(entry: entry)
        }
        .configurationDisplayName("Next Flight")
        .description("See your next upcoming flight at a glance.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - MEDIUM WIDGET — Month Recap

struct MonthRecapEntry: TimelineEntry {
    let date: Date
    let recap: MonthRecapData
}

struct MonthRecapProvider: TimelineProvider {
    func placeholder(in context: Context) -> MonthRecapEntry {
        MonthRecapEntry(date: .now, recap: MonthRecapData(
            monthLabel: "May 2026",
            flightCount: 4,
            miles: 3_820,
            topRoute: "LIS → GVA",
            co2Kg: 412
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (MonthRecapEntry) -> Void) {
        completion(MonthRecapEntry(date: .now, recap: loadMonthRecap()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MonthRecapEntry>) -> Void) {
        let entry = MonthRecapEntry(date: .now, recap: loadMonthRecap())
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct StatTile: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.accent)
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.textSec)
            }
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentDim)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct MonthRecapWidgetView: View {
    let entry: MonthRecapEntry
    @Environment(\.colorScheme) var scheme

    private var recap: MonthRecapData { entry.recap }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Logbook")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.accent)
                    Text(recap.monthLabel)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.primary)
                }
                Spacer()
                if let route = recap.topRoute {
                    Text(route)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentDim)
                        .clipShape(Capsule())
                }
            }

            HStack(spacing: 8) {
                StatTile(
                    icon: "airplane",
                    value: "\(recap.flightCount)",
                    label: recap.flightCount == 1 ? "Flight" : "Flights"
                )
                StatTile(
                    icon: "globe",
                    value: recap.miles > 0 ? "\(recap.miles.formatted())mi" : "0mi",
                    label: "Miles"
                )
                StatTile(
                    icon: "leaf",
                    value: recap.co2Kg > 0 ? "\(recap.co2Kg)kg" : "0kg",
                    label: "CO\u{2082}"
                )
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.cardBg)
    }
}

struct MonthRecapWidget: Widget {
    let kind = "MonthRecapWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MonthRecapProvider()) { entry in
            MonthRecapWidgetView(entry: entry)
        }
        .configurationDisplayName("Monthly Recap")
        .description("Flights, miles and CO\u{00B2} at a glance for this month.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Widget Bundle

@main
struct LogbookWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextFlightWidget()
        MonthRecapWidget()
    }
}
