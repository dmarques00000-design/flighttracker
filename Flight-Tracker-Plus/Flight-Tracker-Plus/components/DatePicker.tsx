import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
    return `${DAYS[(d.getDay() + 7) % 7 === 0 ? 0 : d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return str;
  }
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateStr(value);
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }

  function firstDayOfWeek(y: number, m: number) {
    return new Date(y, m, 1).getDay();
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
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
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDate = parseDateStr(value);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          const p = parseDateStr(value);
          setViewYear(p.getFullYear());
          setViewMonth(p.getMonth());
          setOpen(true);
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
        <Text style={styles.triggerText}>{formatDisplay(value)}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSec} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {/* Month navigation */}
            <View style={styles.navRow}>
              <Pressable onPress={prevMonth} hitSlop={12} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </Pressable>
              <Text style={styles.monthTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.weekRow}>
              {DAYS.map(d => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`e-${idx}`} style={styles.cell} />;

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
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
                      !isSelected && isToday && styles.cellToday,
                    ]}
                    onPress={() => selectDay(day)}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                        !isSelected && isToday && styles.cellTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick shortcuts */}
            <View style={styles.shortcuts}>
              <Pressable
                style={styles.shortcutBtn}
                onPress={() => { onChange(toDateStr(today)); setOpen(false); }}
              >
                <Text style={styles.shortcutText}>Today</Text>
              </Pressable>
              <Pressable
                style={styles.shortcutBtn}
                onPress={() => {
                  const tm = new Date(today);
                  tm.setDate(tm.getDate() + 1);
                  onChange(toDateStr(tm));
                  setOpen(false);
                }}
              >
                <Text style={styles.shortcutText}>Tomorrow</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "DMSans_500Medium",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  monthTitle: {
    fontSize: 17,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: Colors.textSec,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },
  cellSelected: {
    backgroundColor: Colors.accent,
  },
  cellToday: {
    backgroundColor: Colors.accent + "22",
  },
  cellText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: "DMSans_400Regular",
  },
  cellTextSelected: {
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  cellTextToday: {
    color: Colors.accent,
    fontFamily: "DMSans_700Bold",
  },
  shortcuts: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shortcutBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shortcutText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.accent,
  },
});
