import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import FlightShareCard from "@/components/FlightShareCard";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, accent ? { color: accent } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: 14,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
  },
  value: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: "DMSans_500Medium",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
});

export default function FlightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flights } = useFlights();
  const insets = useSafeAreaInsets();
  const flight = flights.find((f) => f.id === id);
  const shareRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleShare() {
    if (!flight) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await (
        shareRef.current as unknown as { capture: () => Promise<string> }
      ).capture();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share ${flight.flightCode} — ${flight.departureAirport} to ${flight.arrivalAirport}`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert("Saved!", "Flight card saved to your camera roll.");
        }
      }
    } catch (e) {
      console.error("Share failed:", e);
      Alert.alert("Error", "Could not share this flight. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  if (!flight) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons
            name="airplane-outline"
            size={36}
            color={Colors.textSec}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.notFoundText}>Flight not found.</Text>
        </View>
      </View>
    );
  }

  const isDelayed = flight.status === "delayed";
  const co2Trees = (flight.co2Kg / 21).toFixed(1);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ViewShot
        ref={shareRef}
        options={{ format: "png", quality: 1.0 }}
        style={styles.hiddenCapture}
      >
        <FlightShareCard flight={flight} />
      </ViewShot>

      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.navBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>Flight</Text>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [
            styles.shareBtn,
            { opacity: sharing || pressed ? 0.7 : 1 },
          ]}
          hitSlop={8}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="share-outline" size={22} color={Colors.accent} />
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={styles.heroOuter}
        >
          <LinearGradient
            colors={["#0D1E38", "#1A2F55", "#0D1E38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.routeRow}>
              <View style={styles.routeEnd}>
                <Text style={styles.iata}>{flight.departureAirport}</Text>
                <Text style={styles.city}>{flight.departureCity}</Text>
              </View>
              <View style={styles.routeMid}>
                <View style={styles.flightLine} />
                <View style={styles.planeCircle}>
                  <Ionicons name="airplane" size={18} color={Colors.accent} />
                </View>
                <View style={styles.flightLine} />
              </View>
              <View style={[styles.routeEnd, { alignItems: "flex-end" }]}>
                <Text style={styles.iata}>{flight.arrivalAirport}</Text>
                <Text style={styles.city}>{flight.arrivalCity}</Text>
              </View>
            </View>

            <View style={styles.timesRow}>
              <Text style={styles.timeText}>{flight.departureTime}</Text>
              <Text style={styles.durationText}>
                {formatHours(flight.durationMinutes)}
              </Text>
              <Text style={styles.timeText}>{flight.arrivalTime}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(60).springify()}
          style={styles.badgeRow}
        >
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{flight.flightCode}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isDelayed
                  ? Colors.red + "22"
                  : Colors.green + "22",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isDelayed ? Colors.red : Colors.green,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isDelayed ? Colors.red : Colors.green },
              ]}
            >
              {isDelayed ? `Delayed +${flight.delayMinutes} min` : "On Time"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          style={styles.statsRow}
        >
          <View style={styles.statBox}>
            <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
            <Text style={styles.statNum}>
              {flight.distanceMiles.toLocaleString()}
            </Text>
            <Text style={styles.statLbl}>miles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="leaf-outline" size={18} color={Colors.green} />
            <Text style={styles.statNum}>{flight.co2Kg}</Text>
            <Text style={styles.statLbl}>kg CO₂</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="hourglass-outline" size={18} color={Colors.amber} />
            <Text style={styles.statNum}>
              {flight.delayMinutes > 0 ? `+${flight.delayMinutes}` : "—"}
            </Text>
            <Text style={styles.statLbl}>min delay</Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(180).springify()}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Flight Info</Text>
          <View style={styles.card}>
            <InfoRow label="Airline" value={flight.airline} />
            <InfoRow label="Aircraft" value={flight.aircraft} />
            <InfoRow label="Date" value={formatDate(flight.date)} />
            <InfoRow
              label="Departure"
              value={`${flight.departureAirport}  ·  ${flight.departureTime}`}
            />
            <InfoRow
              label="Arrival"
              value={`${flight.arrivalAirport}  ·  ${flight.arrivalTime}`}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(240).springify()}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Environmental Impact</Text>
          <View style={styles.card}>
            <InfoRow
              label="CO₂ Emitted"
              value={`${flight.co2Kg} kg`}
              accent={Colors.green}
            />
            <InfoRow
              label="Equivalent trees"
              value={`${co2Trees} trees/year`}
            />
            <InfoRow
              label="Distance"
              value={`${flight.distanceMiles.toLocaleString()} mi  ·  ${Math.round(
                flight.distanceMiles * 1.60934,
              ).toLocaleString()} km`}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.shareCardPreview}
        >
          <Text style={styles.sectionTitle}>Share This Flight</Text>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.shareFlightBtn,
              { opacity: sharing || pressed ? 0.75 : 1 },
            ]}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.shareFlightBtnText}>
                  Share with friends
                </Text>
              </>
            )}
          </Pressable>
          <Text style={styles.shareHint}>
            Generates a boarding-pass style card — share to Instagram, WhatsApp,
            and more.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  hiddenCapture: {
    position: "absolute",
    left: -9999,
    top: 0,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navTitle: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  shareBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
  },
  heroOuter: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "0.2)",
  },
  heroGradient: {
    padding: 22,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  routeEnd: {
    flex: 1,
  },
  routeMid: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  flightLine: {
    flex: 1,
    height: 1,
    backgroundColor: "0.3)",
    width: 20,
  },
  planeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  iata: {
    fontSize: 38,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
    lineHeight: 44,
  },
  city: {
    fontSize: 13,
    color: "#6C63FF0.55)",
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
  },
  timesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "0.15)",
  },
  timeText: {
    fontSize: 22,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  durationText: {
    fontSize: 13,
    color: "#6C63FF0.5)",
    fontFamily: "DMSans_400Regular",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  codeBadge: {
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  codeText: {
    fontSize: 13,
    color: Colors.accent,
    fontFamily: "DMSans_700Bold",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
  },
  statsRow: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  statNum: {
    fontSize: 20,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  statLbl: {
    fontSize: 11,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareCardPreview: {
    marginBottom: 8,
  },
  shareFlightBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  shareFlightBtnText: {
    fontSize: 16,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  shareHint: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    lineHeight: 17,
  },
});
