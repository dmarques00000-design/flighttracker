import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  Modal, TouchableWithoutFeedback, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useTrips, Trip } from "@/context/trips";
import { useFlights, Flight } from "@/context/flights";
import { router } from "expo-router";

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function tripDateRange(flights: Flight[]): string {
  if (flights.length === 0) return "";
  const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
  const first = formatDateShort(sorted[0].date);
  const last  = formatDateShort(sorted[sorted.length - 1].date);
  return first === last ? first : `${first} – ${last}`;
}

// ── Flight picker row ────────────────────────────────────────────────────────
function FlightPickerRow({ flight, selected, onToggle }: { flight: Flight; selected: boolean; onToggle: () => void }) {
  const C = useColors();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13,
        backgroundColor: selected ? C.accentDim : pressed ? C.surface : C.card,
        borderBottomWidth: 1, borderBottomColor: C.border,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>
          {flight.departureAirport} → {flight.arrivalAirport}
        </Text>
        <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
          {flight.flightCode}  ·  {formatDateShort(flight.date)}
        </Text>
      </View>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: selected ? C.accent : C.border,
        backgroundColor: selected ? C.accent : "transparent",
        alignItems: "center", justifyContent: "center",
      }}>
        {selected && <Ionicons name="checkmark" size={13} color={C.white} />}
      </View>
    </Pressable>
  );
}

// ── Create / Edit Trip Modal ─────────────────────────────────────────────────
function TripFormModal({
  visible, onClose, onSave, flights, initialTitle = "", initialIds = [], editMode = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, ids: string[]) => void;
  flights: Flight[];
  initialTitle?: string;
  initialIds?: string[];
  editMode?: boolean;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialTitle);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialIds));

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSelectedIds(new Set(initialIds));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const sortedFlights = useMemo(() =>
    [...flights].sort((a, b) => b.date.localeCompare(a.date)),
    [flights]
  );

  function handleSave() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a name for this trip.");
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert("No flights selected", "Pick at least one flight for this trip.");
      return;
    }
    onSave(title.trim(), Array.from(selectedIds));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 16,
          borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card,
        }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_500Medium" }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>
            {editMode ? "Edit Trip" : "New Trip"}
          </Text>
          <Pressable onPress={handleSave} hitSlop={10}>
            <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_700Bold" }}>Save</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Title input */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Trip Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Europe Summer 2025"
              placeholderTextColor={C.textMuted}
              style={{
                backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
                paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
                color: C.text, fontFamily: "DMSans_400Regular",
              }}
              autoFocus
              returnKeyType="done"
            />
          </View>

          {/* Flight picker */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
              Select Flights ({selectedIds.size} selected)
            </Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
            {sortedFlights.length === 0 ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Ionicons name="airplane-outline" size={32} color={C.textFaint} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 10, textAlign: "center" }}>No flights yet.{"\n"}Add flights first, then create a trip.</Text>
              </View>
            ) : (
              sortedFlights.map((f) => (
                <FlightPickerRow
                  key={f.id}
                  flight={f}
                  selected={selectedIds.has(f.id)}
                  onToggle={() => toggle(f.id)}
                />
              ))
            )}
          </View>
          <View style={{ height: insets.bottom + 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Trip Card ────────────────────────────────────────────────────────────────
function TripCard({ trip, flights, onPress }: { trip: Trip; flights: Flight[]; onPress: () => void }) {
  const C = useColors();
  const tripFlights = useMemo(() => flights.filter((f) => trip.flightIds.includes(f.id)), [flights, trip.flightIds]);
  const dateRange   = useMemo(() => tripDateRange(tripFlights), [tripFlights]);
  const totalMiles  = useMemo(() => tripFlights.reduce((s, f) => s + f.distanceMiles, 0), [tripFlights]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
        marginBottom: 12, overflow: "hidden", opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ height: 3, backgroundColor: C.accent }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold", flex: 1 }} numberOfLines={1}>{trip.title}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="airplane-outline" size={13} color={C.textMuted} />
            <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>
              {tripFlights.length} flight{tripFlights.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {totalMiles > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="globe-outline" size={13} color={C.textMuted} />
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>
                {totalMiles.toLocaleString()} mi
              </Text>
            </View>
          )}
        </View>
        {dateRange ? (
          <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 6 }}>{dateRange}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Main Trips Screen ────────────────────────────────────────────────────────
export default function TripsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { trips, addTrip } = useTrips();
  const { flights } = useFlights();
  const [showForm, setShowForm] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  async function handleCreate(title: string, flightIds: string[]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addTrip(title, flightIds);
    setShowForm(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <TripFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleCreate}
        flights={flights}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 20 }}
        >
          <Text style={{ fontSize: 28, color: C.text, fontFamily: "DMSans_700Bold" }}>Trips</Text>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowForm(true); }}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: C.accent, borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="add" size={16} color={C.white} />
            <Text style={{ fontSize: 13, color: C.white, fontFamily: "DMSans_700Bold" }}>New Trip</Text>
          </Pressable>
        </Animated.View>

        {trips.length === 0 ? (
          <Animated.View entering={FadeIn.delay(100)} style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="briefcase-outline" size={30} color={C.accent} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 8 }}>No trips yet</Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 28 }}>
              Group your flights into trips to keep{"\n"}your journeys organised.
            </Text>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowForm(true); }}
              style={({ pressed }) => ({ backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 28, opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Create First Trip</Text>
            </Pressable>
          </Animated.View>
        ) : (
          trips.map((trip, i) => (
            <Animated.View key={trip.id} entering={FadeInDown.delay(i * 40).springify()}>
              <TripCard
                trip={trip}
                flights={flights}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/trip/[id]", params: { id: trip.id } });
                }}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
