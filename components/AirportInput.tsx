import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  Platform, type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import AIRPORTS_RAW from "@/assets/data/airports.json";
import { Flag } from "@/components/Flag";

// ─── Types ───────────────────────────────────────────────────────────────────
interface AirportEntry {
  iata: string;
  city: string;
  name: string;
}

const AIRPORTS: AirportEntry[] = AIRPORTS_RAW as AirportEntry[];
const MAX_SUGGESTIONS = 6;

function score(entry: AirportEntry, q: string): number {
  const query = q.toUpperCase();
  const iata  = entry.iata.toUpperCase();
  const city  = entry.city.toUpperCase();
  const name  = entry.name.toUpperCase();
  if (iata === query)   return 100;
  if (iata.startsWith(query)) return 90;
  if (city.startsWith(query)) return 80;
  if (city.split(" ").some((w) => w.startsWith(query))) return 70;
  if (name.startsWith(query)) return 60;
  if (name.split(" ").some((w) => w.startsWith(query))) return 50;
  if (city.includes(query) || name.includes(query)) return 30;
  return -1;
}

function getSuggestions(query: string): AirportEntry[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim();
  return AIRPORTS
    .map((a) => ({ entry: a, s: score(a, q) }))
    .filter(({ s }) => s > -1)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ entry }) => entry);
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface AirportInputProps {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  returnKeyType?: TextInputProps["returnKeyType"];
}

// ─── Component ───────────────────────────────────────────────────────────────
export function AirportInput({
  label,
  value,
  onChange,
  placeholder = "e.g. ZRH",
  icon = "airplane-outline",
  returnKeyType = "next",
}: AirportInputProps) {
  const C = useColors();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery]         = useState(value);
  const [showList, setShowList]   = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = getSuggestions(query);
  const isConfirmed = value.length === 3 && query === value;

  const handleChange = useCallback((text: string) => {
    const sanitised = text.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    setQuery(sanitised);
    onChange(sanitised.length === 3 ? sanitised : "");
    setShowList(sanitised.length > 0);
  }, [onChange]);

  const handleSelect = useCallback((airport: AirportEntry) => {
    setQuery(airport.iata);
    onChange(airport.iata);
    setShowList(false);
    inputRef.current?.blur();
  }, [onChange]);

  const handleClear = useCallback(() => {
    setQuery("");
    onChange("");
    setShowList(false);
    inputRef.current?.focus();
  }, [onChange]);

  const borderColor = isFocused ? C.accent : C.border;

  return (
    <View style={{ gap: 8 }}>
      {/* Label */}
      <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, textTransform: "uppercase" }}>
        {label}
      </Text>

      {/* Input row */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor, paddingHorizontal: 14 }}>
        <Ionicons name={icon} size={16} color={isFocused ? C.accent : C.textSec} style={{ marginRight: 10 }} />

        <TextInput
          ref={inputRef}
          style={{ flex: 1, paddingVertical: 15, fontSize: 17, color: C.text, fontFamily: "DMSans_500Medium", letterSpacing: 1 }}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={C.textSec}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          maxLength={3}
          onFocus={() => { setIsFocused(true); if (query.length > 0) setShowList(true); }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowList(false), 150);
          }}
        />

        {/* Confirmed badge with real flag + IATA code */}
        {isConfirmed ? (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
          >
            <Flag iata={value} size={14} />
            <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_700Bold", letterSpacing: 0.5 }}>{value}</Text>
            <Ionicons name="close-circle" size={14} color={C.accent} />
          </Pressable>
        ) : query.length > 0 ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Suggestions dropdown */}
      {showList && suggestions.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(80)}
          style={{
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            overflow: "hidden",
            ...(Platform.OS === "android" ? { elevation: 8 } : {
              shadowColor: C.shadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            }),
          }}
        >
          <ScrollView keyboardShouldPersistTaps="always" scrollEnabled={suggestions.length > 4} style={{ maxHeight: 260 }}>
            {suggestions.map((airport, idx) => (
              <Pressable
                key={airport.iata}
                onPress={() => handleSelect(airport)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 12,
                  backgroundColor: pressed ? C.accentDim : "transparent",
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: C.border,
                })}
              >
                {/* Real country flag */}
                <Flag iata={airport.iata} size={22} />

                {/* City + name */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: C.text, fontFamily: "DMSans_600SemiBold" }} numberOfLines={1}>
                    {airport.city}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }} numberOfLines={1}>
                    {airport.name}
                  </Text>
                </View>

                {/* IATA code badge */}
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: C.accentDim }}>
                  <Text style={{ fontSize: 11, color: C.accent, fontFamily: "DMSans_700Bold", letterSpacing: 0.5 }}>
                    {airport.iata}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}
