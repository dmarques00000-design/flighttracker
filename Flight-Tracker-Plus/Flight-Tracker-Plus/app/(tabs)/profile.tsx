import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useUser, UserProfile } from "@/context/user";
import { useFlights } from "@/context/flights";

const SEAT_OPTIONS: { value: UserProfile["seatPreference"]; label: string; icon: string }[] = [
  { value: "window", label: "Window", icon: "partly-sunny-outline" },
  { value: "middle", label: "Middle", icon: "remove-outline" },
  { value: "aisle", label: "Aisle", icon: "swap-horizontal-outline" },
];

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={16} color={Colors.accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editing,
  icon,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  editing: boolean;
  icon?: string;
  secureTextEntry?: boolean;
}) {
  const maskedValue = secureTextEntry && !editing && value ? "•".repeat(Math.min(value.length, 12)) : value;

  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        {icon && <Ionicons name={icon as any} size={13} color={Colors.textSec} style={{ marginRight: 4 }} />}
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize="none"
          secureTextEntry={false}
        />
      ) : (
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>
          {maskedValue || placeholder || `No ${label.toLowerCase()} set`}
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, clearProfile } = useUser();
  const { flights } = useFlights();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const totalFlights = flights.length;
  const TODAY = new Date().toISOString().substring(0, 10);
  const upcomingFlights = flights.filter((f) => f.date >= TODAY).length;
  const uniqueAirports = new Set(
    flights.flatMap((f) => [f.departureAirport, f.arrivalAirport])
  ).size;

  function startEdit() {
    setDraft({ ...profile });
    setEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(profile);
    Haptics.selectionAsync();
  }

  async function saveEdit() {
    const initials = getInitials(draft.name);
    await updateProfile({ ...draft, avatarInitials: initials });
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmClear() {
    Alert.alert(
      "Clear Profile",
      "This will erase all your account details. Your flights will not be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearProfile();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }

  const initials = profile.avatarInitials || getInitials(profile.name);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 110 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          {!editing ? (
            <Pressable onPress={startEdit} style={styles.editBtn}>
              <Ionicons name="pencil" size={15} color={Colors.accent} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          ) : (
            <View style={styles.editActions}>
              <Pressable onPress={cancelEdit} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={styles.saveBtn}>
                <Ionicons name="checkmark" size={16} color={Colors.white} />
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Avatar + Name */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.avatarInfo}>
            {editing ? (
              <TextInput
                style={styles.nameInput}
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="Your full name"
                placeholderTextColor={Colors.textMuted}
              />
            ) : (
              <Text style={styles.nameText}>{profile.name || "Unnamed Traveller"}</Text>
            )}
            <Text style={styles.emailSubtitle}>{profile.email || "No email set"}</Text>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.statsRow}>
          <StatBox label="Flights" value={totalFlights} />
          <View style={styles.statDivider} />
          <StatBox label="Upcoming" value={upcomingFlights} />
          <View style={styles.statDivider} />
          <StatBox label="Airports" value={uniqueAirports} />
        </Animated.View>

        {/* Personal Info */}
        <Animated.View entering={FadeInDown.delay(90).springify()}>
          <SectionCard title="Personal Info" icon="person-outline">
            <Field
              label="Email"
              value={editing ? draft.email : profile.email}
              onChangeText={(v) => setDraft((d) => ({ ...d, email: v }))}
              placeholder="your@email.com"
              keyboardType="email-address"
              editing={editing}
              icon="mail-outline"
            />
            <Field
              label="Nationality"
              value={editing ? draft.nationality : profile.nationality}
              onChangeText={(v) => setDraft((d) => ({ ...d, nationality: v }))}
              placeholder="e.g. Portuguese"
              editing={editing}
              icon="flag-outline"
            />
            <Field
              label="Home Airport"
              value={editing ? draft.homeCityCode : profile.homeCityCode}
              onChangeText={(v) => setDraft((d) => ({ ...d, homeCityCode: v.toUpperCase() }))}
              placeholder="e.g. LIS"
              editing={editing}
              icon="home-outline"
            />
          </SectionCard>
        </Animated.View>

        {/* Travel Documents */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <SectionCard title="Travel Documents" icon="document-outline">
            <Field
              label="Passport Number"
              value={editing ? draft.passportNumber : profile.passportNumber}
              onChangeText={(v) => setDraft((d) => ({ ...d, passportNumber: v }))
              }
              placeholder="e.g. AB123456"
              editing={editing}
              icon="card-outline"
              secureTextEntry
            />
            <Field
              label="Passport Expiry"
              value={editing ? draft.passportExpiry : profile.passportExpiry}
              onChangeText={(v) => setDraft((d) => ({ ...d, passportExpiry: v }))}
              placeholder="YYYY-MM-DD"
              editing={editing}
              icon="calendar-outline"
            />
          </SectionCard>
        </Animated.View>

        {/* Travel Preferences */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <SectionCard title="Travel Preferences" icon="options-outline">
            <Field
              label="Frequent Flyer No."
              value={editing ? draft.frequentFlyerNumber : profile.frequentFlyerNumber}
              onChangeText={(v) => setDraft((d) => ({ ...d, frequentFlyerNumber: v }))}
              placeholder="e.g. TP-123456"
              editing={editing}
              icon="ribbon-outline"
            />
            <Field
              label="Preferred Airline"
              value={editing ? draft.preferredAirline : profile.preferredAirline}
              onChangeText={(v) => setDraft((d) => ({ ...d, preferredAirline: v }))}
              placeholder="e.g. TAP Air Portugal"
              editing={editing}
              icon="airplane-outline"
            />

            {/* Seat Preference */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="albums-outline" size={13} color={Colors.textSec} style={{ marginRight: 4 }} />
                <Text style={styles.fieldLabel}>Seat Preference</Text>
              </View>
              {editing ? (
                <View style={styles.seatRow}>
                  {SEAT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => { Haptics.selectionAsync(); setDraft((d) => ({ ...d, seatPreference: opt.value })); }}
                      style={[
                        styles.seatBtn,
                        draft.seatPreference === opt.value && styles.seatBtnActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={16}
                        color={draft.seatPreference === opt.value ? Colors.white : Colors.textSec}
                      />
                      <Text
                        style={[
                          styles.seatBtnText,
                          draft.seatPreference === opt.value && styles.seatBtnTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[styles.fieldValue, !profile.seatPreference && styles.fieldValueEmpty]}>
                  {profile.seatPreference
                    ? SEAT_OPTIONS.find((o) => o.value === profile.seatPreference)?.label ?? profile.seatPreference
                    : "No preference set"}
                </Text>
              )}
            </View>
          </SectionCard>
        </Animated.View>

        {/* Danger Zone */}
        {!editing && (
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.dangerSection}>
            <Pressable onPress={confirmClear} style={styles.dangerBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.red} />
              <Text style={styles.dangerBtnText}>Clear Profile Data</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, marginBottom: 20 },
  title: { fontSize: 30, color: Colors.text, fontFamily: "DMSans_700Bold" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.accentDim },
  editBtnText: { fontSize: 14, color: Colors.accent, fontFamily: "DMSans_600SemiBold" },
  editActions: { flexDirection: "row", gap: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.accent },
  saveBtnText: { fontSize: 14, color: Colors.white, fontFamily: "DMSans_700Bold" },

  avatarSection: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  avatarCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  avatarText: { fontSize: 24, color: Colors.white, fontFamily: "DMSans_700Bold" },
  avatarInfo: { flex: 1, gap: 4 },
  nameText: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold" },
  nameInput: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold", borderBottomWidth: 1.5, borderBottomColor: Colors.accent, paddingBottom: 2 },
  emailSubtitle: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  statsRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingVertical: 16, marginBottom: 20 },
  statBox: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 22, color: Colors.accent, fontFamily: "DMSans_700Bold" },
  statLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  sectionCard: { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 },
  sectionTitle: { fontSize: 14, color: Colors.text, fontFamily: "DMSans_700Bold", letterSpacing: 0.3 },

  field: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  fieldLabel: { fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  fieldValue: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_400Regular" },
  fieldValueEmpty: { color: Colors.textMuted, fontStyle: "italic" },
  fieldInput: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_400Regular", borderBottomWidth: 1.5, borderBottomColor: Colors.accent, paddingVertical: 4, paddingHorizontal: 2 },

  seatRow: { flexDirection: "row", gap: 8 },
  seatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  seatBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  seatBtnText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  seatBtnTextActive: { color: Colors.white, fontFamily: "DMSans_700Bold" },

  dangerSection: { marginTop: 8, marginBottom: 8 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: Colors.redDim, backgroundColor: Colors.redDim },
  dangerBtnText: { fontSize: 14, color: Colors.red, fontFamily: "DMSans_600SemiBold" },
});
