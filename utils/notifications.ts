/**
 * notifications.ts
 * Schedules and cancels local push notifications for upcoming flights.
 *
 * Notification ID convention:
 *   `flight-{flightId}-{offsetHours}h`
 * This lets us cancel individual reminders without cancelling all.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Flight } from "@/context/flights";

// Ask for permission once; resolves true if granted.
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** All supported reminder offsets in hours before departure. */
export const REMINDER_OFFSETS = [24, 6, 3] as const;
export type ReminderOffset = typeof REMINDER_OFFSETS[number];

/** Default settings stored in the user profile. */
export interface NotificationPrefs {
  enabled: boolean;
  offsets: ReminderOffset[]; // which global defaults are active
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  offsets: [24],
};

/** Build the notification identifier for a flight + offset. */
export function notifId(flightId: string, offsetHours: number): string {
  return `flight-${flightId}-${offsetHours}h`;
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

  // Build departure datetime (local)
  const [year, month, day] = flight.date.split("-").map(Number);
  const [depH, depM] = flight.departureTime.split(":").map(Number);
  const departure = new Date(year, month - 1, day, depH, depM, 0);
  const triggerDate = new Date(departure.getTime() - offsetHours * 60 * 60 * 1000);

  // Don't schedule if the trigger time is in the past
  if (triggerDate.getTime() <= Date.now()) return null;

  const id = notifId(flight.id, offsetHours);

  // Cancel any existing notification for this slot first
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  const label =
    offsetHours === 24 ? "tomorrow" :
    offsetHours === 6  ? "in 6 hours" :
                         "in 3 hours";

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `✈️ ${flight.flightCode} departs ${label}`,
      body: `${flight.departureAirport} → ${flight.arrivalAirport}  ·  ${flight.departureTime} departure`,
      sound: true,
      data: { flightId: flight.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });

  return id;
}

/** Cancel all reminders for a flight. */
export async function cancelFlightReminders(flightId: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all(
    REMINDER_OFFSETS.map((h) =>
      Notifications.cancelScheduledNotificationAsync(notifId(flightId, h)).catch(() => {})
    )
  );
}

/** Cancel a specific reminder for a flight. */
export async function cancelFlightReminder(
  flightId: string,
  offsetHours: ReminderOffset,
): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(notifId(flightId, offsetHours)).catch(() => {});
}

/**
 * Sync global default reminders for all upcoming flights.
 * Called when the user changes their global preferences.
 */
export async function syncGlobalReminders(
  flights: Flight[],
  prefs: NotificationPrefs,
  today: string,
): Promise<void> {
  if (Platform.OS === "web") return;

  const upcoming = flights.filter((f) => f.date >= today);

  for (const flight of upcoming) {
    // Cancel all existing reminders first
    await cancelFlightReminders(flight.id);

    // Re-schedule only the active offsets (if enabled)
    if (prefs.enabled) {
      for (const offset of prefs.offsets) {
        await scheduleFlightReminder(flight, offset);
      }
    }
  }
}
