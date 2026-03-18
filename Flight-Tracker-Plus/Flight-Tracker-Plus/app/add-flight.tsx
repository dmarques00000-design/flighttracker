import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { DatePicker } from "@/components/DatePicker";

interface FlightLookupResult {
  flightCode: string;
  date: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  arrivalAirport: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  distanceMiles: number;
  co2Kg: number;
  status: "on_time" | "delayed";
  delayMinutes: number;
  aircraft: string;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function todayStr(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function AddFlightScreen() {
  const insets = useSafeAreaInsets();
  const { addFlight, flights } = useFlights();

  const [code, setCode] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FlightLookupResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;

  async function handleLookup() {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode) {
      setError("Please enter a flight code (e.g. LX2819)");
      return;
    }

    setError("");
    setPreview(null);
    setLoading(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await apiRequest(
        "GET",
        `/api/flights/lookup?code=${trimCode}&date=${date}`,
      );
      const data = (await res.json()) as FlightLookupResult;
      setPreview(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(
        "Could not look up that flight. Please check the code and date.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const isDuplicate = flights.some(
        (f) => f.code === preview.flightCode && f.date === preview.date,
      );

      if (isDuplicate) {
        setError("This flight has already been added to your logbook.");
        setSaving(false);
        return;
      }

      await addFlight({
        ...preview,
        status: preview.status || "on_time",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } catch {
      Alert.alert("Error", "Could not save the flight. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.wrapper}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottomPad + 24 },
          ]}
        >
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View style={styles.header}>
              <Text style={styles.title}>Add Flight</Text>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="close" size={24} color={Colors.textSec} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Enter your flight number and tap the date to pick it from the calendar.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={styles.form}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Flight Code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  setPreview(null);
                }}
                placeholder="e.g. LX2819, BA456"
                placeholderTextColor={Colors.textSec}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={8}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setPreview(null);
                }}
              />
            </View>
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={Colors.red}
              />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressable
            onPress={handleLookup}
            disabled={loading}
            style={({ pressed }) => [
              styles.lookupBtn,
              { opacity: loading || pressed ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={Colors.white}
                />
                <Text style={styles.lookupBtnText}>Look Up Flight</Text>
              </>
            )}
          </Pressable>

          {preview && (
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.preview}
            >
              <View style={styles.previewHeader}>
                <Text style={styles.previewCode}>{preview.flightCode}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        preview.status === "delayed"
                          ? Colors.red + "22"
                          : Colors.green + "22",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          preview.status === "delayed"
                            ? Colors.red
                            : Colors.green,
                      },
                    ]}
                  >
                    {preview.status === "delayed"
                      ? `Delayed +${preview.delayMinutes}m`
                      : "On Time"}
                  </Text>
                </View>
              </View>

              <View style={styles.routeDisplay}>
                <View style={styles.routeEnd}>
                  <Text style={styles.iata}>{preview.departureAirport}</Text>
                  <Text style={styles.routeCity}>{preview.departureCity}</Text>
                  <Text style={styles.routeTime}>{preview.departureTime}</Text>
                </View>
                <View style={styles.routeMiddle}>
                  <View style={styles.routeLine} />
                  <Ionicons name="airplane" size={18} color={Colors.accent} />
                  <View style={styles.routeLine} />
                </View>
                <View style={[styles.routeEnd, { alignItems: "flex-end" }]}>
                  <Text style={styles.iata}>{preview.arrivalAirport}</Text>
                  <Text style={styles.routeCity}>{preview.arrivalCity}</Text>
                  <Text style={styles.routeTime}>{preview.arrivalTime}</Text>
                </View>
              </View>

              <View style={styles.previewDivider} />

              <Text style={styles.airlineText}>{preview.airline}</Text>
              <Text style={styles.aircraftText}>{preview.aircraft}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={Colors.textSec}
                  />
                  <Text style={styles.statItemText}>
                    {formatHours(preview.durationMinutes)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons
                    name="navigate-outline"
                    size={14}
                    color={Colors.textSec}
                  />
                  <Text style={styles.statItemText}>
                    {preview.distanceMiles.toLocaleString()} mi
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons
                    name="leaf-outline"
                    size={14}
                    color={Colors.green}
                  />
                  <Text style={[styles.statItemText, { color: Colors.green }]}>
                    {preview.co2Kg} kg CO₂
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { opacity: saving || pressed ? 0.8 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <Text style={styles.saveBtnText}>Add to Logbook</Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scroll: {
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    marginBottom: 28,
    lineHeight: 20,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    fontFamily: "DMSans_500Medium",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.red + "18",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: Colors.red,
    fontFamily: "DMSans_400Regular",
    flex: 1,
  },
  lookupBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  lookupBtnText: {
    fontSize: 16,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  preview: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 20,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  previewCode: {
    fontSize: 18,
    color: Colors.accent,
    fontFamily: "DMSans_700Bold",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
  },
  routeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  routeEnd: {
    flex: 1,
  },
  routeMiddle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    width: 20,
  },
  iata: {
    fontSize: 26,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  routeCity: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    marginTop: 1,
  },
  routeTime: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: "DMSans_500Medium",
    marginTop: 4,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  airlineText: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: "DMSans_500Medium",
  },
  aircraftText: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statItemText: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
});
