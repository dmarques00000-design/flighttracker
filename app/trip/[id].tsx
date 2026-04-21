import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, Alert, Platform, Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useTrips, TripStatus } from "@/context/trips";
import { useFlights, Flight } from "@/context/flights";

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
}

function getAutoTripStatus(flights: Flight[]): TripStatus {
  if (flights.length === 0) return "planned";
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sorted[0]?.date;
  const lastDate = sorted[sorted.length - 1]?.date;
  if (firstDate && firstDate > today) return "planned";
  if (lastDate && lastDate < today) return "completed";
  return "upcoming";
}

function getStatusMeta(C: ReturnType<typeof useColors>, status: TripStatus) {
  switch (status) {
    case "planned":
      return { label: "Planned", icon: "calendar-outline", color: C.accent, bg: C.accentDim, border: C.accent + "40" };
    case "upcoming":
      return { label: "Upcoming", icon: "time-outline", color: C.amber, bg: C.amberDim, border: C.amber + "40" };
    case "completed":
    default:
      return { label: "Completed", icon: "checkmark-circle-outline", color: C.green, bg: C.greenDim, border: C.green + "40" };
  }
}

function FlightRow({ flight }: { flight: Flight }) {
  const C = useColors();
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/flight/[id]", params: { id: flight.id } }); }}
      style={({ pressed }) => ({
        flexDirection: "row", backgroundColor: C.card, borderRadius: 14,
        marginBottom: 8, borderWidth: 1, borderColor: C.border,
        overflow: "hidden", opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 3, backgroundColor: C.accent }} />
      <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.departureAirport}</Text>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            <Ionicons name="airplane" size={12} color={C.accent} />
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          </View>
          <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.arrivalAirport}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
            {flight.flightCode}  ·  {formatDateShort(flight.date)}
          </Text>
          {flight.durationMinutes > 0 && (
            <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>{formatHours(flight.durationMinutes)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function TripDetailScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, removeTrip, updateTrip, setTripStatus } = useTrips();
  const { flights } = useFlights();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const trip = useMemo(() => trips.find((t) => t.id === id), [trips, id]);
  const tripFlights = useMemo(() =>
    trip ? [...flights.filter((f) => trip.flightIds.includes(f.id))].sort((a, b) => a.date.localeCompare(b.date)) : [],
    [flights, trip]
  );

  const totalMiles   = useMemo(() => tripFlights.reduce((s, f) => s + f.distanceMiles, 0), [tripFlights]);
  const totalMinutes = useMemo(() => tripFlights.reduce((s, f) => s + f.durationMinutes, 0), [tripFlights]);
  const totalCo2     = useMemo(() => tripFlights.reduce((s, f) => s + f.co2Kg, 0), [tripFlights]);
  const autoStatus   = useMemo(() => getAutoTripStatus(tripFlights), [tripFlights]);
  const currentStatus: TripStatus = trip?.status ?? autoStatus;
  const statusMeta = getStatusMeta(C, currentStatus);

  async function handlePickCover() {
    if (!trip) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo library access to choose a cover photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateTrip(trip.id, trip.title, trip.flightIds, result.assets[0].uri);
    }
  }

  function handleDelete() {
    Alert.alert("Delete Trip", `Delete "${trip?.title}"? Your flights won't be affected.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await removeTrip(id!);
          router.back();
        },
      },
    ]);
  }

  function handleStatusPicker() {
    if (!trip) return;
    Alert.alert("Trip Status", "Choose a status for this trip.", [
      { text: `Planned${currentStatus === "planned" ? " ✓" : ""}`, onPress: () => setTripStatus(trip.id, "planned") },
      { text: `Upcoming${currentStatus === "upcoming" ? " ✓" : ""}`, onPress: () => setTripStatus(trip.id, "upcoming") },
      { text: `Completed${currentStatus === "completed" ? " ✓" : ""}`, onPress: () => setTripStatus(trip.id, "completed") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.textSec, fontFamily: "DMSans_400Regular" }}>Trip not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 12 }}>
            <Pressable onPress={() => router.back()} hitSlop={10}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="chevron-back" size={20} color={C.accent} />
              <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_500Medium" }}>Trips</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={handleStatusPicker} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name="flag-outline" size={20} color={statusMeta.color} />
              </Pressable>
              <Pressable onPress={handlePickCover} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name="image-outline" size={20} color={C.accent} />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name="trash-outline" size={20} color={C.red} />
              </Pressable>
            </View>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(0).springify()}>
          {trip.coverUri ? (
            <Image source={{ uri: trip.coverUri }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
          ) : (
            <Pressable
              onPress={handlePickCover}
              style={({ pressed }) => ({
                height: 220,
                marginHorizontal: 20,
                borderRadius: 24,
                backgroundColor: C.accentDim,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Ionicons name="image-outline" size={26} color={C.accent} />
              </View>
              <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 4 }}>Add cover photo</Text>
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>Choose one from your gallery</Text>
            </Pressable>
          )}
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          <Animated.View entering={FadeInDown.delay(30).springify()} style={{ paddingTop: 18, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 30, color: C.text, fontFamily: "DMSans_700Bold", flex: 1 }}>{trip.title}</Text>
              <Pressable
                onPress={handleStatusPicker}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: statusMeta.bg, borderWidth: 1, borderColor: statusMeta.border,
                  opacity: pressed ? 0.82 : 1,
                }]}
              >
                <Ionicons name={statusMeta.icon as never} size={14} color={statusMeta.color} />
                <Text style={{ fontSize: 12, color: statusMeta.color, fontFamily: "DMSans_700Bold" }}>{statusMeta.label}</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
              {tripFlights.length} flight{tripFlights.length !== 1 ? "s" : ""}
            </Text>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 6 }}>
              Suggested automatically from your flight dates, but you can change it anytime.
            </Text>
          </Animated.View>

          {tripFlights.length > 0 && (
            <Animated.View entering={FadeInDown.delay(40).springify()}
              style={{ flexDirection: "row", gap: 10, marginBottom: 28 }}>
              {[
                { icon: "globe-outline", label: "Miles", value: totalMiles.toLocaleString() },
                { icon: "time-outline", label: "In air", value: formatHours(totalMinutes) },
                { icon: "leaf-outline", label: "CO₂", value: `${totalCo2.toFixed(0)}kg` },
              ].map((stat) => (
                <View key={stat.label} style={{
                  flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: C.border, alignItems: "center", gap: 4,
                }}>
                  <Ionicons name={stat.icon as never} size={18} color={C.accent} />
                  <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>{stat.value}</Text>
                  <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{stat.label}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Flights</Text>
            {tripFlights.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Ionicons name="airplane-outline" size={28} color={C.textMuted} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 10 }}>No flights linked to this trip.</Text>
              </View>
            ) : (
              tripFlights.map((f) => <FlightRow key={f.id} flight={f} />)
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
