import React, { useRef, useState, useMemo } from "react";
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Linking } from "react-native";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import StoryCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/StoryCard";

const SCALE = 0.78;
const H_MARGIN = -(CARD_WIDTH * (1 - SCALE)) / 2;
const V_MARGIN = -(CARD_HEIGHT * (1 - SCALE)) / 2;

export default function ShareScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const cardRef = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);

  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<"all" | number>(currentYear);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!isNaN(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const filtered = useMemo(
    () =>
      period === "all"
        ? flights
        : flights.filter((f) => f.date.startsWith(String(period))),
    [flights, period]
  );

  const periodLabel = period === "all" ? "All Time" : String(period);

  async function captureCard(): Promise<string | null> {
    if (!cardRef.current) return null;
    try {
      const uri = await (
        cardRef.current as unknown as { capture: () => Promise<string> }
      ).capture();
      return uri;
    } catch (e) {
      console.error("Capture failed:", e);
      return null;
    }
  }

  async function handleShare() {
    if (filtered.length === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureCard();
      if (!uri) {
        Alert.alert("Error", "Could not capture the card. Please try again.");
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your year in the air",
        });
      } else {
        Alert.alert(
          "Sharing not available",
          "Please save the image and share manually."
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCapturing(false);
    }
  }

  async function handleSaveToPhotos() {
    if (filtered.length === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await captureCard();
      if (!uri) {
        Alert.alert("Error", "Could not capture the card.");
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to save your card."
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Saved!",
        "Your year recap has been saved to your camera roll. Open Instagram or WhatsApp to share it to your story."
      );
    } finally {
      setCapturing(false);
    }
  }

  async function handleInstagram() {
    if (filtered.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const uri = await captureCard();
    if (!uri) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === "granted") {
      await MediaLibrary.saveToLibraryAsync(uri);
    }
    const canOpen = await Linking.canOpenURL("instagram://story-camera");
    if (canOpen) {
      await Linking.openURL("instagram://story-camera");
    } else {
      const available = await Sharing.isAvailableAsync();
      if (available) await Sharing.shareAsync(uri, { mimeType: "image/png" });
    }
  }

  async function handleWhatsApp() {
    if (filtered.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const uri = await captureCard();
    if (!uri) return;
    const available = await Sharing.isAvailableAsync();
    if (available) await Sharing.shareAsync(uri, { mimeType: "image/png" });
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.textSec} />
        </Pressable>
        <Text style={styles.navTitle}>Year Recap</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
      >
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={styles.periodRow}
        >
          <Pressable
            onPress={() => setPeriod("all")}
            style={[styles.pill, period === "all" && styles.pillActive]}
          >
            <Text style={[styles.pillText, period === "all" && styles.pillTextActive]}>
              All Time
            </Text>
          </Pressable>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => {
                Haptics.selectionAsync();
                setPeriod(y);
              }}
              style={[styles.pill, period === y && styles.pillActive]}
            >
              <Text style={[styles.pillText, period === y && styles.pillTextActive]}>
                {y}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(60).springify()}
          style={styles.cardOuter}
        >
          <ViewShot
            ref={cardRef}
            options={{ format: "png", quality: 1.0 }}
            style={{
              transform: [{ scale: SCALE }],
              marginHorizontal: H_MARGIN,
              marginVertical: V_MARGIN,
              borderRadius: 24,
              overflow: "hidden",
              shadowColor: "#4F8EF0",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.35,
              shadowRadius: 28,
              elevation: 16,
            }}
          >
            <StoryCard flights={filtered} periodLabel={periodLabel} />
          </ViewShot>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          style={styles.hint}
        >
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={Colors.textSec}
          />
          <Text style={styles.hintText}>
            Tap Share to open the system share sheet — post directly to Instagram
            Stories, WhatsApp, Facebook, and more.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          style={styles.actions}
        >
          <Pressable
            onPress={handleShare}
            disabled={capturing || filtered.length === 0}
            style={({ pressed }) => [
              styles.shareBtn,
              {
                opacity:
                  capturing || filtered.length === 0 ? 0.45 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {capturing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={Colors.white} />
                <Text style={styles.shareBtnText}>Share</Text>
              </>
            )}
          </Pressable>

          <View style={styles.quickRow}>
            <Pressable
              onPress={handleInstagram}
              disabled={capturing}
              style={({ pressed }) => [
                styles.quickBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.quickIcon, { backgroundColor: "#C13584" }]}>
                <Ionicons name="logo-instagram" size={20} color="#fff" />
              </View>
              <Text style={styles.quickLabel}>Instagram</Text>
            </Pressable>

            <Pressable
              onPress={handleWhatsApp}
              disabled={capturing}
              style={({ pressed }) => [
                styles.quickBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.quickIcon, { backgroundColor: "#25D366" }]}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              </View>
              <Text style={styles.quickLabel}>WhatsApp</Text>
            </Pressable>

            <Pressable
              onPress={handleSaveToPhotos}
              disabled={capturing}
              style={({ pressed }) => [
                styles.quickBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.quickIcon,
                  {
                    backgroundColor: Colors.card,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  },
                ]}
              >
                <Ionicons name="download-outline" size={20} color={Colors.text} />
              </View>
              <Text style={styles.quickLabel}>Save</Text>
            </Pressable>
          </View>
        </Animated.View>

        {filtered.length === 0 && (
          <Text style={styles.noFlightsText}>
            No flights logged for {periodLabel}.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navTitle: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: "DMSans_700Bold",
  },
  scroll: {
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 24,
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillText: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
  },
  pillTextActive: {
    color: Colors.white,
  },
  cardOuter: {
    alignItems: "center",
  },
  hint: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    lineHeight: 18,
  },
  actions: {
    width: "100%",
    gap: 16,
  },
  shareBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  shareBtnText: {
    fontSize: 17,
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
  },
  quickBtn: {
    alignItems: "center",
    gap: 7,
  },
  quickIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
  },
  noFlightsText: {
    fontSize: 14,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
  },
});
