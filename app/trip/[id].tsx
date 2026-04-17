import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useTrips } from "@/context/trips";
import { useFlights, Flight } from "@/context/flights";

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
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
  const { trips, removeTrip } = useTrips();
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      >
        {/* Nav */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="chevron-back" size={20} color={C.accent} />
            <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_500Medium" }}>Trips</Text>
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="trash-outline" size={20} color={C.red} />
          </Pressable>
        </View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ paddingTop: 12, paddingBottom: 24 }}>
          <Text style={{ fontSize: 30, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 4 }}>{trip.title}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
            {tripFlights.length} flight{tripFlights.length !== 1 ? "s" : ""}
          </Text>
        </Animated.View>

        {/* Stats row */}
        {tripFlights.length > 0 && (
          <Animated.View entering={FadeInDown.delay(40).springify()}
            style={{ flexDirection: "row", gap: 10, marginBottom: 28 }}>
            {[
              { icon: "globe-outline",    label: "Miles",    value: totalMiles.toLocaleString() },
              { icon: "time-outline",     label: "In air",   value: formatHours(totalMinutes) },
              { icon: "leaf-outline",     label: "CO₂",      value: `${totalCo2.toFixed(0)}kg` },
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

        {/* Flights */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Flights</Text>
          {tripFlights.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Ionicons name="airplane-outline" size={28} color={C.textFaint} />
              <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 10 }}>No flights linked to this trip.</Text>
            </View>
          ) : (
            tripFlights.map((f) => <FlightRow key={f.id} flight={f} />)
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
