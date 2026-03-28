import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useUser, UserProfile } from "@/context/user";
import { useFlights } from "@/context/flights";
import { useTheme, ThemeMode } from "@/context/theme";
import { FeedbackModal } from "@/components/FeedbackModal";
import { getAirportInfo } from "@/utils/passport";
import {
  REMINDER_OFFSETS,
  ReminderOffset,
  requestNotificationPermission,
  syncGlobalReminders,
} from "@/utils/notifications";

const SEAT_OPTIONS: { value: UserProfile["seatPreference"]; label: string; icon: string }[] = [
  { value: "window", label: "Window", icon: "partly-sunny-outline" },
  { value: "middle", label: "Middle",  icon: "remove-outline" },
  { value: "aisle",  label: "Aisle",   icon: "swap-horizontal-outline" },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light",  label: "Light", icon: "sunny-outline" },
  { value: "system", label: "Auto",  icon: "phone-portrait-outline" },
  { value: "dark",   label: "Dark",  icon: "moon-outline" },
];

const OFFSET_LABELS: Record<ReminderOffset, string> = {
  24: "24h before",
  6:  "6h before",
  3:  "3h before",
};

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
}
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatBox({ label, value, C }: { label: string; value: string | number; C: ReturnType<typeof useColors> }) {
  return (
    <View style={styles(C).statBox}>
      <Text style={styles(C).statValue}>{value}</Text>
      <Text style={styles(C).statLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children, C }: { title: string; icon: string; children: React.ReactNode; C: ReturnType<typeof useColors> }) {
  return (
    <View style={styles(C).sectionCard}>
      <View style={styles(C).sectionHeader}>
        <Ionicons name={icon as any} size={16} color={C.accent} />
        <Text style={styles(C).sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, editing, icon, C,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "email-address";
  editing: boolean; icon?: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles(C).field}>
      <View style={styles(C).fieldLabelRow}>
        {icon && <Ionicons name={icon as any} size={13} color={C.textSec} style={{ marginRight: 4 }} />}
        <Text style={styles(C).fieldLabel}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          style={styles(C).fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize="none"
        />
      ) : (
        <Text style={[styles(C).fieldValue, !value && styles(C).fieldValueEmpty]}>
          {value || placeholder || `No ${label.toLowerCase()} set`}
        </Text>
      )}
    </View>
  );
}

// A single row item for the flight highlights section
function HighlightRow({ icon, accent, title, subtitle, badge, C }: {
  icon: string; accent: string; title: string; subtitle: string; badge?: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 0,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: accent + "1A",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Ionicons name={icon as any} size={17} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, color: C.text, fontFamily: "DMSans_700Bold" }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={{
          paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
          backgroundColor: accent + "18", borderWidth: 1, borderColor: accent + "40",
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 12, color: accent, fontFamily: "DMSans_700Bold" }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

function NotLoggedInState({ C }: { C: ReturnType<typeof useColors> }) {
  return (
    <Animated.View entering={FadeIn.delay(80)} style={styles(C).notLoggedIn}>
      <View style={styles(C).notLoggedInIcon}>
        <Ionicons name="person-circle-outline" size={64} color={C.accent} />
      </View>
      <Text style={styles(C).notLoggedInTitle}>Your profile is waiting</Text>
      <Text style={styles(C).notLoggedInSub}>
        Create a free account to back up your flights, sync across devices, and unlock sharing features.
      </Text>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/auth"); }}
        style={({ pressed }) => [styles(C).notLoggedInBtn, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="person-add-outline" size={16} color={C.white} />
        <Text style={styles(C).notLoggedInBtnText}>Create Account / Log In</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/auth")} style={{ marginTop: 14 }} hitSlop={10}>
        <Text style={styles(C).notLoggedInLink}>Already have an account? Sign in \u2192</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { profile, isLoggedIn, notifPrefs, updateProfile, updateNotifPrefs, clearProfile, logout } = useUser();
  const { flights } = useFlights();
  const { mode, setMode } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const TODAY           = new Date().toISOString().substring(0, 10);
  const totalFlights    = flights.length;
  const upcomingFlights = flights.filter((f) => f.date >= TODAY).length;
  const uniqueAirports  = new Set(flights.flatMap((f) => [f.departureAirport, f.arrivalAirport])).size;

  // All-time flight highlights for the profile stats section
  const flightStats = useMemo(() => {
    const totalMiles   = flights.reduce((s, f) => s + f.distanceMiles, 0);
    const totalMin     = flights.reduce((s, f) => s + f.durationMinutes, 0);
    const airportSet   = new Set(flights.flatMap((f) => [f.departureAirport, f.arrivalAirport]));
    const countrySet   = new Set<string>();
    for (const code of airportSet) { const info = getAirportInfo(code); if (info) countrySet.add(info.countryCode); }
    const longest      = flights.length > 0 ? flights.reduce((best, f) => f.distanceMiles > best.distanceMiles ? f : best) : null;
    const airlineCount = new Map<string, number>();
    for (const f of flights) { airlineCount.set(f.airline, (airlineCount.get(f.airline) ?? 0) + 1); }
    let topAirline: { name: string; count: number } | null = null;
    for (const [name, c] of airlineCount) { if (!topAirline || c > topAirline.count) topAirline = { name, count: c }; }
    const avgMin = flights.length >= 2 ? Math.round(totalMin / flights.length) : null;
    return { totalMiles, totalMin, uniqueCountries: countrySet.size, longest, topAirline, avgMin };
  }, [flights]);

  function startEdit() { setDraft({ ...profile }); setEditing(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  function cancelEdit() { setEditing(false); setDraft(profile); Haptics.selectionAsync(); }
  async function saveEdit() {
    await updateProfile({ ...draft, avatarInitials: getInitials(draft.name) });
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleNotifToggle(value: boolean) {
    Haptics.selectionAsync();
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Please enable notifications for Logbook in your device Settings to receive flight reminders.");
        return;
      }
    }
    const updated = { ...notifPrefs, enabled: value };
    await updateNotifPrefs(updated);
    await syncGlobalReminders(flights, updated, TODAY);
  }

  async function handleOffsetToggle(offset: ReminderOffset, value: boolean) {
    Haptics.selectionAsync();
    const newOffsets = value ? [...notifPrefs.offsets, offset] : notifPrefs.offsets.filter((o) => o !== offset);
    const updated = { ...notifPrefs, offsets: newOffsets as ReminderOffset[] };
    await updateNotifPrefs(updated);
    if (notifPrefs.enabled) await syncGlobalReminders(flights, updated, TODAY);
  }

  function confirmLogout() {
    Alert.alert("Log Out", "You'll remain a guest and your flights will stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { await logout(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  }
  function confirmClear() {
    Alert.alert("Clear Profile", "This will erase all your account details. Your flights will not be affected.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => { await clearProfile(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  }

  const initials = profile.avatarInitials || getInitials(profile.name);
  const S = styles(C);

  return (
    <View style={[S.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.scroll, { paddingBottom: bottomPadding + 110 }]}>

        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>Profile</Text>
          {isLoggedIn && !editing && (
            <Pressable onPress={startEdit} style={S.editBtn}>
              <Ionicons name="pencil" size={15} color={C.accent} />
              <Text style={S.editBtnText}>Edit</Text>
            </Pressable>
          )}
          {editing && (
            <View style={S.editActions}>
              <Pressable onPress={cancelEdit} style={S.cancelBtn}><Text style={S.cancelBtnText}>Cancel</Text></Pressable>
              <Pressable onPress={saveEdit} style={S.saveBtn}>
                <Ionicons name="checkmark" size={16} color={C.white} />
                <Text style={S.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          )}
        </View>

        {!isLoggedIn && <NotLoggedInState C={C} />}

        {isLoggedIn && (
          <>
            {/* Avatar + Name */}
            <Animated.View entering={FadeInDown.delay(0).springify()} style={S.avatarSection}>
              <View style={S.avatarCircle}>
                <Text style={S.avatarText}>{initials}</Text>
              </View>
              <View style={S.avatarInfo}>
                {editing ? (
                  <TextInput style={S.nameInput} value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Your full name" placeholderTextColor={C.textMuted} />
                ) : (
                  <Text style={S.nameText}>{profile.name || "Unnamed Traveller"}</Text>
                )}
                <Text style={S.emailSubtitle}>{profile.email || "No email set"}</Text>
              </View>
            </Animated.View>

            {/* Stats row */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={S.statsRow}>
              <StatBox label="Flights"   value={totalFlights}    C={C} />
              <View style={S.statDivider} />
              <StatBox label="Upcoming"  value={upcomingFlights} C={C} />
              <View style={S.statDivider} />
              <StatBox label="Airports"  value={uniqueAirports}  C={C} />
            </Animated.View>

            {/* ─── Flight Highlights (new cards moved from home) ─── */}
            {flights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(70).springify()}>
                <SectionCard title="Flight Highlights" icon="stats-chart-outline" C={C}>
                  <HighlightRow
                    icon="location-outline"
                    accent={C.accent}
                    title={String(uniqueAirports)}
                    subtitle="Airports visited (all time)"
                    badge={`${flightStats.uniqueCountries} countr${flightStats.uniqueCountries === 1 ? "y" : "ies"}`}
                    C={C}
                  />
                  <View style={{ height: 1, backgroundColor: C.border, marginVertical: 2 }} />
                  {flightStats.avgMin !== null && (
                    <>
                      <HighlightRow
                        icon="timer-outline"
                        accent={C.amber}
                        title={formatHours(flightStats.avgMin)}
                        subtitle="Average flight duration"
                        C={C}
                      />
                      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 2 }} />
                    </>
                  )}
                  {flightStats.longest && (
                    <>
                      <HighlightRow
                        icon="airplane-outline"
                        accent={C.accent}
                        title={`${flightStats.longest.departureAirport} \u2192 ${flightStats.longest.arrivalAirport}`}
                        subtitle="Longest flight"
                        badge={`${formatNumber(flightStats.longest.distanceMiles)} mi`}
                        C={C}
                      />
                      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 2 }} />
                    </>
                  )}
                  {flightStats.topAirline && flights.length > 1 && (
                    <HighlightRow
                      icon="briefcase-outline"
                      accent={C.secondary}
                      title={flightStats.topAirline.name}
                      subtitle="Most-flown airline"
                      badge={`${flightStats.topAirline.count}\u00d7`}
                      C={C}
                    />
                  )}
                </SectionCard>
              </Animated.View>
            )}

            {/* Appearance */}
            <Animated.View entering={FadeInDown.delay(80).springify()}>
              <SectionCard title="Appearance" icon="color-palette-outline" C={C}>
                <View style={S.field}>
                  <View style={S.fieldLabelRow}>
                    <Ionicons name="contrast-outline" size={13} color={C.textSec} style={{ marginRight: 4 }} />
                    <Text style={S.fieldLabel}>Theme</Text>
                  </View>
                  <View style={S.themeRow}>
                    {THEME_OPTIONS.map((opt) => (
                      <Pressable key={opt.value} onPress={() => { Haptics.selectionAsync(); setMode(opt.value); }}
                        style={[S.themeBtn, mode === opt.value && S.themeBtnActive]}>
                        <Ionicons name={opt.icon as any} size={16} color={mode === opt.value ? C.white : C.textSec} />
                        <Text style={[S.themeBtnText, mode === opt.value && S.themeBtnTextActive]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </SectionCard>
            </Animated.View>

            {/* Notifications */}
            {!editing && (
              <Animated.View entering={FadeInDown.delay(95).springify()}>
                <SectionCard title="Flight Reminders" icon="notifications-outline" C={C}>
                  <View style={[S.field, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: C.text, fontFamily: "DMSans_600SemiBold" }}>Enable reminders</Text>
                      <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2, lineHeight: 17 }}>Get notified before all upcoming flights</Text>
                    </View>
                    <Switch value={notifPrefs.enabled} onValueChange={handleNotifToggle} trackColor={{ false: C.border, true: C.accent }} thumbColor={C.white} />
                  </View>
                  {notifPrefs.enabled && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16, gap: 2 }}>
                      <Text style={[S.fieldLabel, { marginBottom: 8 }]}>Remind me</Text>
                      {REMINDER_OFFSETS.map((offset) => {
                        const isOn = notifPrefs.offsets.includes(offset);
                        return (
                          <View key={offset} style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1 }, isOn ? { backgroundColor: C.accentDim, borderColor: C.accent + "55" } : { backgroundColor: C.surface, borderColor: C.border }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isOn ? C.accent + "22" : C.card, alignItems: "center", justifyContent: "center" }}>
                                <Ionicons name="alarm-outline" size={16} color={isOn ? C.accent : C.textMuted} />
                              </View>
                              <Text style={{ fontSize: 14, fontFamily: isOn ? "DMSans_600SemiBold" : "DMSans_400Regular", color: isOn ? C.text : C.textSec }}>{OFFSET_LABELS[offset]}</Text>
                            </View>
                            <Switch value={isOn} onValueChange={(v) => handleOffsetToggle(offset, v)} trackColor={{ false: C.border, true: C.accent }} thumbColor={C.white} />
                          </View>
                        );
                      })}
                      <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 4, lineHeight: 16 }}>These defaults apply to all upcoming flights. You can also set reminders for individual flights from their detail page.</Text>
                    </Animated.View>
                  )}
                </SectionCard>
              </Animated.View>
            )}

            {/* Personal Info */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <SectionCard title="Personal Info" icon="person-outline" C={C}>
                <Field label="Email"        value={editing ? draft.email        : profile.email}        onChangeText={(v) => setDraft((d) => ({ ...d, email: v }))}        placeholder="your@email.com"   keyboardType="email-address" editing={editing} icon="mail-outline"  C={C} />
                <Field label="Nationality"  value={editing ? draft.nationality  : profile.nationality}  onChangeText={(v) => setDraft((d) => ({ ...d, nationality: v }))}  placeholder="e.g. Portuguese"  editing={editing} icon="flag-outline"  C={C} />
                <Field label="Home Airport" value={editing ? draft.homeCityCode : profile.homeCityCode} onChangeText={(v) => setDraft((d) => ({ ...d, homeCityCode: v.toUpperCase() }))} placeholder="e.g. LIS" editing={editing} icon="home-outline" C={C} />
              </SectionCard>
            </Animated.View>

            {/* Travel Preferences */}
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <SectionCard title="Travel Preferences" icon="options-outline" C={C}>
                <Field label="Frequent Flyer No." value={editing ? draft.frequentFlyerNumber : profile.frequentFlyerNumber} onChangeText={(v) => setDraft((d) => ({ ...d, frequentFlyerNumber: v }))} placeholder="e.g. TP-123456" editing={editing} icon="ribbon-outline" C={C} />
                <Field label="Preferred Airline"  value={editing ? draft.preferredAirline    : profile.preferredAirline}    onChangeText={(v) => setDraft((d) => ({ ...d, preferredAirline: v }))}    placeholder="e.g. TAP Air Portugal" editing={editing} icon="airplane-outline" C={C} />
                <View style={S.field}>
                  <View style={S.fieldLabelRow}>
                    <Ionicons name="albums-outline" size={13} color={C.textSec} style={{ marginRight: 4 }} />
                    <Text style={S.fieldLabel}>Seat Preference</Text>
                  </View>
                  {editing ? (
                    <View style={S.seatRow}>
                      {SEAT_OPTIONS.map((opt) => (
                        <Pressable key={opt.value} onPress={() => { Haptics.selectionAsync(); setDraft((d) => ({ ...d, seatPreference: opt.value })); }}
                          style={[S.seatBtn, draft.seatPreference === opt.value && S.seatBtnActive]}>
                          <Ionicons name={opt.icon as any} size={16} color={draft.seatPreference === opt.value ? C.white : C.textSec} />
                          <Text style={[S.seatBtnText, draft.seatPreference === opt.value && S.seatBtnTextActive]}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={[S.fieldValue, !profile.seatPreference && S.fieldValueEmpty]}>
                      {profile.seatPreference ? SEAT_OPTIONS.find((o) => o.value === profile.seatPreference)?.label ?? profile.seatPreference : "No preference set"}
                    </Text>
                  )}
                </View>
              </SectionCard>
            </Animated.View>

            {/* Beta Feedback */}
            {!editing && (
              <Animated.View entering={FadeInDown.delay(140).springify()}>
                <SectionCard title="Beta" icon="flask-outline" C={C}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accent + "18", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      <Ionicons name="chatbubbles-outline" size={18} color={C.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: C.text, fontFamily: "DMSans_600SemiBold", marginBottom: 3 }}>Share your feedback</Text>
                      <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular", lineHeight: 18 }}>Found a bug or have an idea? Let us know \u2014 your feedback shapes the next release.</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFeedbackVisible(true); }}
                    style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="send-outline" size={15} color={C.white} />
                    <Text style={{ fontSize: 14, color: C.white, fontFamily: "DMSans_700Bold" }}>Send Feedback</Text>
                  </Pressable>
                </SectionCard>
              </Animated.View>
            )}

            {/* Account actions */}
            {!editing && (
              <Animated.View entering={FadeInDown.delay(160).springify()} style={S.dangerSection}>
                <Pressable onPress={confirmLogout} style={[S.dangerBtn, { marginBottom: 10, backgroundColor: C.surface, borderColor: C.border }]}>
                  <Ionicons name="log-out-outline" size={16} color={C.textSec} />
                  <Text style={[S.dangerBtnText, { color: C.textSec }]}>Log Out</Text>
                </Pressable>
                <Pressable onPress={confirmClear} style={S.dangerBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                  <Text style={S.dangerBtnText}>Clear Profile Data</Text>
                </Pressable>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        userName={profile.name}
        userEmail={profile.email}
      />
    </View>
  );
}

const styles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { paddingHorizontal: 20, paddingTop: 4 },

  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, marginBottom: 20 },
  title:        { fontSize: 30, color: C.text, fontFamily: "DMSans_700Bold" },
  editBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.accentDim },
  editBtnText:  { fontSize: 14, color: C.accent, fontFamily: "DMSans_600SemiBold" },
  editActions:  { flexDirection: "row", gap: 8 },
  cancelBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  cancelBtnText:{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_500Medium" },
  saveBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.accent },
  saveBtnText:  { fontSize: 14, color: C.white, fontFamily: "DMSans_700Bold" },

  notLoggedIn:       { alignItems: "center", paddingTop: 40, paddingHorizontal: 10, paddingBottom: 20 },
  notLoggedInIcon:   { marginBottom: 16 },
  notLoggedInTitle:  { fontSize: 22, color: C.text,    fontFamily: "DMSans_700Bold",    marginBottom: 10, textAlign: "center" },
  notLoggedInSub:    { fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 },
  notLoggedInBtn:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 15, borderRadius: 30, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 },
  notLoggedInBtnText:{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" },
  notLoggedInLink:   { fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" },

  avatarSection: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  avatarCircle:  { width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  avatarText:    { fontSize: 24, color: C.white, fontFamily: "DMSans_700Bold" },
  avatarInfo:    { flex: 1, gap: 4 },
  nameText:      { fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold" },
  nameInput:     { fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingBottom: 2 },
  emailSubtitle: { fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" },

  statsRow:    { flexDirection: "row", backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 16, marginBottom: 20 },
  statBox:     { flex: 1, alignItems: "center", gap: 3 },
  statValue:   { fontSize: 22, color: C.accent, fontFamily: "DMSans_700Bold" },
  statLabel:   { fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  sectionCard:   { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 },
  sectionTitle:  { fontSize: 14, color: C.text, fontFamily: "DMSans_700Bold", letterSpacing: 0.3 },

  field:           { marginBottom: 14 },
  fieldLabelRow:   { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  fieldLabel:      { fontSize: 11, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  fieldValue:      { fontSize: 15, color: C.text,    fontFamily: "DMSans_400Regular" },
  fieldValueEmpty: { color: C.textMuted, fontStyle: "italic" },
  fieldInput:      { fontSize: 15, color: C.text,    fontFamily: "DMSans_400Regular", borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingVertical: 4, paddingHorizontal: 2 },

  themeRow:           { flexDirection: "row", gap: 8 },
  themeBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  themeBtnActive:     { backgroundColor: C.accent, borderColor: C.accent },
  themeBtnText:       { fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" },
  themeBtnTextActive: { color: C.white, fontFamily: "DMSans_700Bold" },

  seatRow:           { flexDirection: "row", gap: 8 },
  seatBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  seatBtnActive:     { backgroundColor: C.accent, borderColor: C.accent },
  seatBtnText:       { fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" },
  seatBtnTextActive: { color: C.white, fontFamily: "DMSans_700Bold" },

  dangerSection: { marginTop: 8, marginBottom: 8 },
  dangerBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: C.redDim, backgroundColor: C.redDim },
  dangerBtnText: { fontSize: 14, color: C.red, fontFamily: "DMSans_600SemiBold" },
});
