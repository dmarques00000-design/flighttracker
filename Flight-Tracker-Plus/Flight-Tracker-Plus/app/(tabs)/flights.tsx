import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FlightItem({
  flight,
  onDelete,
  index,
}: {
  flight: Flight;
  onDelete: () => void;
  index: number;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleTrash() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirming(true);
  }

  function handleConfirmDelete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setConfirming(false);
    onDelete();
  }

  function handleCancelDelete() {
    setConfirming(false);
  }

  function handlePress() {
    if (confirming) {
      setConfirming(false);
      return;
    }
    router.push({ pathname: "/flight/[id]", params: { id: flight.id } });
  }

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        entering={FadeInDown.delay(index * 40).springify()}
        style={styles.card}
      >
        <View style={styles.cardMain}>
          <View style={styles.routeCol}>
            <View style={styles.routeRow}>
              <Text style={styles.airport}>{flight.departureAirport}</Text>
              <Ionicons
                name="arrow-forward"
                size={12}
                color={Colors.textSec}
                style={{ marginHorizontal: 6 }}
              />
              <Text style={styles.airport}>{flight.arrivalAirport}</Text>
            </View>
            <Text style={styles.meta}>
              {flight.flightCode} · {formatDate(flight.date)}
            </Text>
          </View>

          <View style={styles.rightCol}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    flight.status === "delayed" ? Colors.red : Colors.green,
                },
              ]}
            />
            {!confirming ? (
              <Pressable
                onPress={handleTrash}
                hitSlop={14}
                style={styles.trashBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={Colors.textSec}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {confirming && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={styles.confirmRow}
          >
            <Pressable onPress={handleCancelDelete} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirmDelete} style={styles.deleteBtn}>
              <Ionicons name="trash" size={14} color={Colors.white} />
              <Text style={styles.deleteText}>Remove</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function FlightsScreen() {
  const insets = useSafeAreaInsets();
  const { flights, removeFlight } = useFlights();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <FlatList
        data={flights}
        keyExtractor={(f) => f.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPadding + 100 },
        ]}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>All Flights</Text>
            <Text style={styles.count}>{flights.length} logged</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <Animated.View entering={FadeInDown.springify()} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="airplane-outline"
                size={36}
                color={Colors.textSec}
              />
            </View>
            <Text style={styles.emptyTitle}>No flights yet</Text>
            <Text style={styles.emptySub}>
              Add your first flight to start building your logbook.
            </Text>
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.emptyBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.emptyBtnText}>Add Flight</Text>
            </Pressable>
          </Animated.View>
        )}
        renderItem={({ item, index }) => (
          <FlightItem
            flight={item}
            index={index}
            onDelete={() => removeFlight(item.id)}
          />
        )}
      />
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <Ionicons name="add" size={26} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 30,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  count: {
    fontSize: 14,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeCol: {
    flex: 1,
    gap: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  airport: {
    fontSize: 18,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  meta: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trashBtn: {
    padding: 4,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  deleteText: {
    fontSize: 13,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  empty: {
    paddingTop: 60,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 20,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 15,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
});
