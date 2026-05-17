/**
 * notifications.ts
 * Schedules and cancels local push notifications for upcoming flights.
 *
 * Notification ID convention:
 *   `flight-{flightId}-{offsetHours}h`
 * This lets us cancel individual reminders without cancelling all.
 *
 * NOTE: expo-notifications is an optional peer dependency. If it is not
 * installed all functions become silent no-ops so the app still bundles.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Flight } from "@/context/flights";
import { AIRPORT_TIMEZONES } from "@/utils/airportTimezones";

// ---------------------------------------------------------------------------
// Lazy loader — returns the Notifications namespace or null if not installed.
// ---------------------------------------------------------------------------
type NotificationsModule = typeof import("expo-notifications");
let _notif: NotificationsModule | null | undefined = undefined; // undefined = not yet attempted

function getNotif(): NotificationsModule | null {
  if (_notif !== undefined) return _notif;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _notif = require("expo-notifications") as NotificationsModule;
  } catch {
    _notif = null;
  }
  return _notif;
}

// ---------------------------------------------------------------------------
// Timezone-aware departure epoch
// ---------------------------------------------------------------------------

/**
 * Convert an airport-local departure date + HH:MM to an exact UTC epoch (ms).
 *
 * Uses the same Intl-offset technique as computeActualBlockMinutes so that
 * DST transitions on the departure date are handled correctly.
 *
 * Falls back to device-local wall-clock interpretation when the IATA code is
 * not present in AIRPORT_TIMEZONES (unknown/private airports).
 *
 * @param date   "YYYY-MM-DD"
 * @param time   "HH:MM" in departure airport local time
 * @param iata   Departure airport IATA code
 * @returns      UTC milliseconds for the exact departure instant
 */
function departureUtcMs(date: string, time: string, iata: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [depH, depM] = time.split(":").map(Number);

  const tz = AIRPORT_TIMEZONES[iata];
  if (!tz) {
    // Unknown airport — fall back to device local time (original behaviour).
    return new Date(year, month - 1, day, depH, depM, 0).getTime();
  }

  // Step 1: treat the local time naively as UTC to get a probe Date.
  const isoLocal = `${date}T${String(depH).padStart(2, "0")}:${String(depM).padStart(2, "0")}:00`;
  const probe = new Date(`${isoLocal}Z`);

  // Step 2: ask Intl what the wall-clock time looks like in the airport's
  // timezone when the UTC clock shows `probe`. The difference between the
  // naive UTC value and the Intl-rendered local value is the UTC offset.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(probe);
  const p: Record<string, number> = {};
  for (const { type, value } of parts) {
    if (["year", "month", "day", "hour", "minute"].includes(type))
      p[type] = parseInt(value, 10);
  }

  // Minutes since midnight in each representation
  const localTotal = p["hour"] * 60 + p["minute"];
  const naiveTotal = depH * 60 + depM;
  // offset (min) = naiveTotal - localTotal  →  local + offset = utc naive
  const offsetMin = naiveTotal - localTotal;

  // Step 3: the true UTC epoch is the naive UTC epoch minus the offset error.
  // Equivalently: localMs + offsetMin * 60_000 = utcMs
  return probe.getTime() - offsetMin * 60_000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All supported reminder offsets in hours before departure. */
export const REMINDER_OFFSETS = [24, 6, 3] as const;
export type ReminderOffset = typeof REMINDER_OFFSETS[number];

/** Default settings stored in the user profile. */
export interface NotificationPrefs {
  enabled: boolean;
  offsets: ReminderOffset[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  offsets: [24],
};

/** Build the notification identifier for a flight + offset. */
export function notifId(flightId: string, offsetHours: number): string {
  return `flight-${flightId}-${offsetHours}h`;
}

/** AsyncStorage key for per-flight individual reminder offsets. */
function individualReminderKey(flightId: string): string {
  return `@flighttracker_individual_reminders_${flightId}`;
}

/**
 * Load the set of individually-set reminder offsets for a specific flight.
 * Returns null if no individual overrides exist for that flight.
 */
export async function getIndividualRemindersForFlight(
  flightId: string,
): Promise<Set<ReminderOffset> | null> {
  try {
    const raw = await AsyncStorage.getItem(individualReminderKey(flightId));
    if (!raw) return null;
    const parsed: ReminderOffset[] = JSON.parse(raw);
    return new Set(parsed);
  } catch {
    return null;
  }
}

/**
 * Save individual reminder offsets for a flight and schedule/cancel the
 * corresponding notifications.
 * Pass an empty Set (or null) to clear all individual overrides and remove
 * any individually-scheduled notifications for that flight.
 */
export async function saveIndividualRemindersForFlight(
  flight: Flight,
  offsets: Set<ReminderOffset> | null,
): Promise<void> {
  const key = individualReminderKey(flight.id);

  // Cancel whatever was previously individually scheduled
  await cancelFlightReminders(flight.id);

  if (!offsets || offsets.size === 0) {
    await AsyncStorage.removeItem(key);
    return;
  }

  // Persist
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(offsets)));

  // Schedule each chosen offset
  for (const offset of offsets) {
    await scheduleFlightReminder(flight, offset);
  }
}

/** Ask for permission once; resolves true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const N = getNotif();
  if (!N) return false;
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await N.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule a reminder for a single flight at a given offset (hours before departure).
 *
 * The trigger time is computed from the departure airport's local timezone, not the
 * device timezone. A user in Zurich scheduling a reminder for a 10:00 JFK departure
 * will correctly receive the "24h before" notification at 16:00 Zurich time the day
 * before (i.e. 24h before 10:00 New York time), not at 10:00 Zurich time.
 *
 * Returns the scheduled notification identifier, or null if scheduling fails / is in the past.
 */
export async function scheduleFlightReminder(
  flight: Flight,
  offsetHours: ReminderOffset,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const N = getNotif();
  if (!N) return null;

  // Convert departure airport local time → UTC epoch, then subtract the offset.
  const departureUtc = departureUtcMs(
    flight.date,
    flight.departureTime,
    flight.departureAirport,
  );
  const triggerMs = departureUtc - offsetHours * 60 * 60 * 1000;

  if (triggerMs <= Date.now()) return null;

  const id = notifId(flight.id, offsetHours);
  await N.cancelScheduledNotificationAsync(id).catch(() => {});

  const label =
    offsetHours === 24 ? "tomorrow" :
    offsetHours === 6  ? "in 6 hours" :
                         "in 3 hours";

  await N.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `✈️ ${flight.flightCode} departs ${label}`,
      body: `${flight.departureAirport} → ${flight.arrivalAirport}  ·  ${flight.departureTime} departure`,
      sound: true,
      data: { flightId: flight.id },
    },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
  });

  return id;
}

/** Cancel all reminders for a flight. */
export async function cancelFlightReminders(flightId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const N = getNotif();
  if (!N) return;
  await Promise.all(
    REMINDER_OFFSETS.map((h) =>
      N.cancelScheduledNotificationAsync(notifId(flightId, h)).catch(() => {})
    )
  );
}

/** Cancel a specific reminder for a flight. */
export async function cancelFlightReminder(
  flightId: string,
  offsetHours: ReminderOffset,
): Promise<void> {
  if (Platform.OS === "web") return;
  const N = getNotif();
  if (!N) return;
  await N.cancelScheduledNotificationAsync(notifId(flightId, offsetHours)).catch(() => {});
}

/**
 * Returns the set of ReminderOffset values that are currently scheduled
 * for the given flight. Returns an empty Set on web or if expo-notifications
 * is not installed.
 */
export async function getScheduledOffsetsForFlight(
  flightId: string,
): Promise<Set<ReminderOffset>> {
  const result = new Set<ReminderOffset>();
  if (Platform.OS === "web") return result;
  const N = getNotif();
  if (!N) return result;
  const all = await N.getAllScheduledNotificationsAsync();
  const ids = new Set(all.map((n) => n.identifier));
  for (const offset of REMINDER_OFFSETS) {
    if (ids.has(notifId(flightId, offset))) result.add(offset);
  }
  return result;
}

/**
 * Returns true if the given flight has at least one reminder scheduled.
 */
export async function hasAnyReminderForFlight(flightId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const N = getNotif();
  if (!N) return false;
  const all = await N.getAllScheduledNotificationsAsync();
  const ids = new Set(all.map((n) => n.identifier));
  return REMINDER_OFFSETS.some((offset) => ids.has(notifId(flightId, offset)));
}

/**
 * Sync global default reminders for all upcoming flights.
 * Called when the user changes their global notification preferences.
 * Flights that have individual overrides are skipped — their own schedule
 * is managed independently.
 */
export async function syncGlobalReminders(
  flights: Flight[],
  prefs: NotificationPrefs,
  today: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  const N = getNotif();
  if (!N) return;

  const upcoming = flights.filter((f) => f.date >= today);
  for (const flight of upcoming) {
    // Don't overwrite individually-set reminders
    const individual = await getIndividualRemindersForFlight(flight.id);
    if (individual !== null) continue;

    await cancelFlightReminders(flight.id);
    if (prefs.enabled) {
      for (const offset of prefs.offsets) {
        await scheduleFlightReminder(flight, offset);
      }
    }
  }
}
