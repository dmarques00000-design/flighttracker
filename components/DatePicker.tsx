import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR + 1 - 2020 + 1 },
  (_, i) => 2020 + i,
);

function parseDateStr(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDisplay(str: string): string {
  try {
    const d = parseDateStr(str);
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return str;
  }
}

type PickerMode = "calendar" | "month" | "year";

const CELL_SIZE = 38;

export function DatePicker({ value, onChange }: DatePickerProps) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("calendar");

  const parsed = parseDateStr(value);
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yearListRef = useRef<FlatList>(null);

  function openPicker() {
    const p = parseDateStr(value);
    setViewYear(p.getFullYear());
    setViewMonth(p.getMonth());
    setMode("calendar");
    setOpen(true);
  }

  function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }

  function firstDayOfWeek(y: number, m: number) {
    return new Date(y, m, 1).getDay();
  }

  function selectDay(day: number) {
    const selected = new Date(viewYear, viewMonth, day);
    onChange(toDateStr(selected));
    setOpen(false);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startOffset = firstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDate = parseDateStr(value);
  const selectedYearIndex = YEARS.indexOf(viewYear);

  return (
    <>
      {/* ── Trigger ── */}
      <Pressable
        onPress={openPicker}
        style={{
          backgroundColor: C.card,
          borderRadius: 14,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: C.border,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={C.accent} />
        <Text style={{ flex: 1, fontSize: 16, color: C.text, fontFamily: "DMSans_500Medium" }}>
          {formatDisplay(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.textSec} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: C.surface,
              borderRadius: 20,
              padding: 20,
              width: "100%",
              maxWidth: 360,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
              borderWidth: 1,
              borderColor: C.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >

            {/* ── CALENDAR MODE ── */}
            {mode === "calendar" && (
              <>
                {/* Nav row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Pressable
                    hitSlop={12}
                    style={{ padding: 6, borderRadius: 8, backgroundColor: C.card }}
                    onPress={() => {
                      if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
                      else setViewMonth(m => m - 1);
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color={C.text} />
                  </Pressable>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}
                      onPress={() => setMode("month")}
                    >
                      <Text style={{ fontSize: 15, fontFamily: "DMSans_700Bold", color: C.text }}>{MONTHS[viewMonth]}</Text>
                      <Ionicons name="chevron-down" size={13} color={C.accent} />
                    </Pressable>
                    <Pressable
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}
                      onPress={() => {
                        setMode("year");
                        setTimeout(() => {
                          yearListRef.current?.scrollToIndex({ index: Math.max(0, selectedYearIndex - 2), animated: false });
                        }, 80);
                      }}
                    >
                      <Text style={{ fontSize: 15, fontFamily: "DMSans_700Bold", color: C.text }}>{viewYear}</Text>
                      <Ionicons name="chevron-down" size={13} color={C.accent} />
                    </Pressable>
                  </View>

                  <Pressable
                    hitSlop={12}
                    style={{ padding: 6, borderRadius: 8, backgroundColor: C.card }}
                    onPress={() => {
                      if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
                      else setViewMonth(m => m + 1);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={C.text} />
                  </Pressable>
                </View>

                {/* Day headers */}
                <View style={{ flexDirection: "row", marginBottom: 4 }}>
                  {DAYS_SHORT.map((d) => (
                    <Text key={d} style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontFamily: "DMSans_500Medium", color: C.textSec, paddingVertical: 4 }}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Day grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
                  {cells.map((day, idx) => {
                    if (!day) return <View key={`e-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;

                    const cellDate = new Date(viewYear, viewMonth, day);
                    const isSelected =
                      cellDate.getFullYear() === selectedDate.getFullYear() &&
                      cellDate.getMonth() === selectedDate.getMonth() &&
                      cellDate.getDate() === selectedDate.getDate();
                    const isToday =
                      cellDate.getFullYear() === today.getFullYear() &&
                      cellDate.getMonth() === today.getMonth() &&
                      cellDate.getDate() === today.getDate();

                    return (
                      <Pressable
                        key={`d-${idx}`}
                        style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
                        onPress={() => selectDay(day)}
                      >
                        <View style={[
                          { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: "center", justifyContent: "center" },
                          isSelected && { backgroundColor: C.accent },
                          !isSelected && isToday && { backgroundColor: C.accent + "22" },
                        ]}>
                          <Text style={[
                            { fontSize: 14, color: C.text, fontFamily: "DMSans_400Regular" },
                            isSelected && { color: C.white, fontFamily: "DMSans_700Bold" },
                            !isSelected && isToday && { color: C.accent, fontFamily: "DMSans_700Bold" },
                          ]}>
                            {day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Shortcuts */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Pressable
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.card, alignItems: "center", borderWidth: 1, borderColor: C.border }}
                    onPress={() => { onChange(toDateStr(today)); setOpen(false); }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: "DMSans_500Medium", color: C.accent }}>Today</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.card, alignItems: "center", borderWidth: 1, borderColor: C.border }}
                    onPress={() => {
                      const tm = new Date(today);
                      tm.setDate(tm.getDate() + 1);
                      onChange(toDateStr(tm));
                      setOpen(false);
                    }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: "DMSans_500Medium", color: C.accent }}>Tomorrow</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* ── MONTH PICKER MODE ── */}
            {mode === "month" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Pressable onPress={() => setMode("calendar")} hitSlop={12} style={{ flexDirection: "row", alignItems: "center", gap: 2, width: 60 }}>
                    <Ionicons name="chevron-back" size={18} color={C.accent} />
                    <Text style={{ fontSize: 14, fontFamily: "DMSans_500Medium", color: C.accent }}>Back</Text>
                  </Pressable>
                  <Text style={{ fontSize: 17, fontFamily: "DMSans_700Bold", color: C.text }}>Select Month</Text>
                  <View style={{ width: 60 }} />
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {MONTHS.map((m, idx) => {
                    const isSel = idx === viewMonth;
                    return (
                      <Pressable
                        key={m}
                        style={[
                          { width: "22%", paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, flexGrow: 1 },
                          isSel && { backgroundColor: C.accent, borderColor: C.accent },
                        ]}
                        onPress={() => { setViewMonth(idx); setMode("calendar"); }}
                      >
                        <Text style={[
                          { fontSize: 14, fontFamily: "DMSans_500Medium", color: C.text },
                          isSel && { color: C.white, fontFamily: "DMSans_700Bold" },
                        ]}>
                          {MONTHS_SHORT[idx]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── YEAR PICKER MODE ── */}
            {mode === "year" && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Pressable onPress={() => setMode("calendar")} hitSlop={12} style={{ flexDirection: "row", alignItems: "center", gap: 2, width: 60 }}>
                    <Ionicons name="chevron-back" size={18} color={C.accent} />
                    <Text style={{ fontSize: 14, fontFamily: "DMSans_500Medium", color: C.accent }}>Back</Text>
                  </Pressable>
                  <Text style={{ fontSize: 17, fontFamily: "DMSans_700Bold", color: C.text }}>Select Year</Text>
                  <View style={{ width: 60 }} />
                </View>
                <FlatList
                  ref={yearListRef}
                  data={YEARS}
                  keyExtractor={(item) => String(item)}
                  style={{ maxHeight: 260 }}
                  getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
                  initialScrollIndex={Math.max(0, selectedYearIndex - 3)}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSel = item === viewYear;
                    return (
                      <Pressable
                        style={[
                          { height: 52, justifyContent: "center", alignItems: "center", borderRadius: 12, marginVertical: 2 },
                          isSel && { backgroundColor: C.accent },
                        ]}
                        onPress={() => { setViewYear(item); setMode("calendar"); }}
                      >
                        <Text style={[
                          { fontSize: 17, fontFamily: "DMSans_400Regular", color: C.text },
                          isSel && { color: C.white, fontFamily: "DMSans_700Bold" },
                        ]}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            )}

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
