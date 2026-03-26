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
import { Flight } from "@/context/flights";

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
 * Returns the scheduled notification identifier, or null if scheduling fails / is in the past.
 */
export async function scheduleFlightReminder(
  flight: Flight,
  offsetHours: ReminderOffset,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const N = getNotif();
  if (!N) return null;

  const [year, month, day] = flight.date.split("-").map(Number);
  const [depH, depM] = flight.departureTime.split(":").map(Number);
  const departure = new Date(year, month - 1, day, depH, depM, 0);
  const triggerDate = new Date(departure.getTime() - offsetHours * 60 * 60 * 1000);

  if (triggerDate.getTime() <= Date.now()) return null;

  const id = notifId(flight.id, offsetHours);
  await N.cancelScheduledNotificationAsync(id).catch(() => {});

  const label =
    offsetHours === 24 ? "tomorrow" :
    offsetHours === 6  ? "in 6 hours" :
                         "in 3 hours";

  await N.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `\u2708\uFE0F ${flight.flightCode} departs ${label}`,
      body: `${flight.departureAirport} \u2192 ${flight.arrivalAirport}  \u00b7  ${flight.departureTime} departure`,
      sound: true,
      data: { flightId: flight.id },
    },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: triggerDate },
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
    await cancelFlightReminders(flight.id);
    if (prefs.enabled) {
      for (const offset of prefs.offsets) {
        await scheduleFlightReminder(flight, offset);
      }
    }
  }
}
