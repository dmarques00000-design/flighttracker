import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  Modal, Alert, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from "react-native-reanimated";
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
  return first === last ? first : `${first} \u2013 ${last}`;
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function TripCardSkeleton() {
  const C = useColors();
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [shimmer]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.9]),
  }));

  return (
    <Animated.View style={[{
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
      borderColor: C.border, marginBottom: 12, overflow: "hidden",
    }, animStyle]}>
      {/* Cover placeholder */}
      <View style={{ height: 92, backgroundColor: C.surface }} />
      <View style={{ padding: 16, gap: 10 }}>
        {/* Title bar */}
        <View style={{ height: 16, width: "55%", backgroundColor: C.surface, borderRadius: 6 }} />
        {/* Meta bars */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ height: 12, width: 70, backgroundColor: C.surface, borderRadius: 4 }} />
          <View style={{ height: 12, width: 90, backgroundColor: C.surface, borderRadius: 4 }} />
        </View>
        {/* Date bar */}
        <View style={{ height: 11, width: "40%", backgroundColor: C.surface, borderRadius: 4 }} />
      </View>
    </Animated.View>
  );
}

function TripsSkeletonList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <TripCardSkeleton key={i} />
      ))}
    </>
  );
}

// ─── Flight picker row ────────────────────────────────────────────────────────
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
          {flight.departureAirport} \u2192 {flight.arrivalAirport}
        </Text>
        <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
          {flight.flightCode}  \u00b7  {formatDateShort(flight.date)}
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

// ─── Create / edit modal ──────────────────────────────────────────────────────
function TripFormModal({
  visible, onClose, onSave, flights, trips,
  initialTitle = "", initialIds = [], initialCoverUri,
  editMode = false, editingTripId,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, ids: string[], coverUri?: string) => void;
  flights: Flight[];
  trips: Trip[];
  initialTitle?: string;
  initialIds?: string[];
  initialCoverUri?: string;
  editMode?: boolean;
  editingTripId?: string;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialTitle);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialIds));
  const [coverUri, setCoverUri] = useState<string | undefined>(initialCoverUri);

  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setSelectedIds(new Set(initialIds));
      setCoverUri(initialCoverUri);
    }
  }, [visible, initialTitle, initialIds, initialCoverUri]);

  const assignedFlightIds = useMemo(() => {
    const ids = new Set<string>();
    trips.forEach((trip) => {
      if (trip.id === editingTripId) return;
      trip.flightIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [trips, editingTripId]);

  const availableFlights = useMemo(() =>
    flights.filter((f) => selectedIds.has(f.id) || !assignedFlightIds.has(f.id)),
    [flights, selectedIds, assignedFlightIds]
  );

  const toggle = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const sortedFlights = useMemo(() =>
    [...availableFlights].sort((a, b) => b.date.localeCompare(a.date)),
    [availableFlights]
  );

  async function pickCover() {
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
      setCoverUri(result.assets[0].uri);
    }
  }

  function handleSave() {
    if (!title.trim()) { Alert.alert("Title required", "Please enter a name for this trip."); return; }
    if (selectedIds.size === 0) { Alert.alert("No flights selected", "Pick at least one flight for this trip."); return; }
    onSave(title.trim(), Array.from(selectedIds), coverUri);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
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

          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Cover Photo</Text>
            <Pressable
              onPress={pickCover}
              style={({ pressed }) => ({
                backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
                borderColor: C.border, overflow: "hidden", opacity: pressed ? 0.9 : 1,
              })}
            >
              {coverUri ? (
                <View>
                  <Image source={{ uri: coverUri }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
                  <View style={{
                    position: "absolute", right: 12, top: 12,
                    backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 16,
                    paddingHorizontal: 10, paddingVertical: 6,
                  }}>
                    <Text style={{ fontSize: 12, color: C.white, fontFamily: "DMSans_700Bold" }}>Change</Text>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 8 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="image-outline" size={22} color={C.accent} />
                  </View>
                  <Text style={{ fontSize: 14, color: C.text, fontFamily: "DMSans_700Bold" }}>Choose cover photo</Text>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center" }}>Pick an image from your gallery for this trip.</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
              Select Flights ({selectedIds.size} selected)
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
              Flights already linked to another trip are hidden.
            </Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
            {sortedFlights.length === 0 ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Ionicons name="airplane-outline" size={32} color={C.textMuted} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 10, textAlign: "center" }}>
                  No available flights.{"\n"}Add flights first or remove them from another trip.
                </Text>
              </View>
            ) : (
              sortedFlights.map((f) => (
                <FlightPickerRow key={f.id} flight={f} selected={selectedIds.has(f.id)} onToggle={() => toggle(f.id)} />
              ))
            )}
          </View>
          <View style={{ height: insets.bottom + 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────
function TripCard({
  trip, flights, onPress, onToggleStar,
}: {
  trip: Trip;
  flights: Flight[];
  onPress: () => void;
  onToggleStar: () => void;
}) {
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
      {/* Cover */}
      {trip.coverUri ? (
        <Image source={{ uri: trip.coverUri }} style={{ width: "100%", height: 150 }} resizeMode="cover" />
      ) : (
        <View style={{ height: 92, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="briefcase-outline" size={28} color={C.accent} />
        </View>
      )}

      <View style={{ padding: 16 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold", flex: 1 }} numberOfLines={1}>
            {trip.title}
          </Text>
          {/* Star button */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleStar(); }}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: 8 })}
          >
            <Ionicons
              name={trip.starred ? "star" : "star-outline"}
              size={18}
              color={trip.starred ? C.amber : C.textMuted}
            />
          </Pressable>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} style={{ marginLeft: 8 }} />
        </View>

        {/* Meta row */}
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

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label, color }: { icon: string; label: string; color: string }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, marginTop: 4 }}>
      <Ionicons name={icon as never} size={14} color={color} />
      <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_700Bold", letterSpacing: 0.9, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TripsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { trips, isLoading, addTrip, toggleStar } = useTrips();
  const { flights } = useFlights();
  const [showForm, setShowForm] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const starredTrips  = useMemo(() => trips.filter((t) => t.starred),  [trips]);
  const regularTrips  = useMemo(() => trips.filter((t) => !t.starred), [trips]);

  async function handleCreate(title: string, flightIds: string[], coverUri?: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addTrip(title, flightIds, coverUri);
    setShowForm(false);
  }

  function navigateToTrip(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/trip/[id]", params: { id } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <TripFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleCreate}
        flights={flights}
        trips={trips}
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

        {/* ── Loading skeleton ── */}
        {isLoading && <TripsSkeletonList />}

        {/* ── Empty state (only after loading completes) ── */}
        {!isLoading && trips.length === 0 && (
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
        )}

        {/* ── Starred section ── */}
        {!isLoading && starredTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <SectionLabel icon="star" label="Starred" color={C.amber} />
            {starredTrips.map((trip, i) => (
              <Animated.View key={trip.id} entering={FadeInDown.delay(i * 40).springify()}>
                <TripCard
                  trip={trip}
                  flights={flights}
                  onPress={() => navigateToTrip(trip.id)}
                  onToggleStar={() => toggleStar(trip.id)}
                />
              </Animated.View>
            ))}
            {regularTrips.length > 0 && (
              <View style={{ height: 1, backgroundColor: C.border, marginBottom: 20, marginTop: 4 }} />
            )}
          </Animated.View>
        )}

        {/* ── All / remaining trips section ── */}
        {!isLoading && regularTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(starredTrips.length > 0 ? 60 : 30).springify()}>
            {starredTrips.length > 0 && (
              <SectionLabel icon="time-outline" label="All Trips" color={C.textMuted} />
            )}
            {regularTrips.map((trip, i) => (
              <Animated.View key={trip.id} entering={FadeInDown.delay(i * 40).springify()}>
                <TripCard
                  trip={trip}
                  flights={flights}
                  onPress={() => navigateToTrip(trip.id)}
                  onToggleStar={() => toggleStar(trip.id)}
                />
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
