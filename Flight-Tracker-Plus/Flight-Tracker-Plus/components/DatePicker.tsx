import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

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

export function DatePicker({ value, onChange }: DatePickerProps) {
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
      <Pressable style={styles.trigger} onPress={openPicker}>
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
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>

            {/* CALENDAR MODE */}
            {mode === "calendar" && (
              <>
                <View style={styles.navRow}>
                  <Pressable
                    style={styles.navArrow}
                    hitSlop={12}
                    onPress={() => {
                      if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
                      else setViewMonth(m => m - 1);
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.text} />
                  </Pressable>

                  <View style={styles.headerCenter}>
                    <Pressable style={styles.headerChip} onPress={() => setMode("month")}>
                      <Text style={styles.headerChipText}>{MONTHS[viewMonth]}</Text>
                      <Ionicons name="chevron-down" size={13} color={Colors.accent} />
                    </Pressable>
                    <Pressable
                      style={styles.headerChip}
                      onPress={() => {
                        setMode("year");
                        setTimeout(() => {
                          yearListRef.current?.scrollToIndex({
                            index: Math.max(0, selectedYearIndex - 2),
                            animated: false,
                          });
                        }, 80);
                      }}
                    >
                      <Text style={styles.headerChipText}>{viewYear}</Text>
                      <Ionicons name="chevron-down" size={13} color={Colors.accent} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.navArrow}
                    hitSlop={12}
                    onPress={() => {
                      if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
                      else setViewMonth(m => m + 1);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.text} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {DAYS_SHORT.map((d) => (
                    <Text key={d} style={styles.dayHeader}>{d}</Text>
                  ))}
                </View>

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
                      <Pressable key={`d-${idx}`} style={styles.cell} onPress={() => selectDay(day)}>
                        <View style={[
                          styles.cellInner,
                          isSelected && styles.cellSelected,
                          !isSelected && isToday && styles.cellToday,
                        ]}>
                          <Text style={[
                            styles.cellText,
                            isSelected && styles.cellTextSelected,
                            !isSelected && isToday && styles.cellTextToday,
                          ]}>
                            {day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

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
              </>
            )}

            {/* MONTH PICKER MODE */}
            {mode === "month" && (
              <>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={() => setMode("calendar")} hitSlop={12} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={18} color={Colors.accent} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                  <Text style={styles.pickerTitle}>Select Month</Text>
                  <View style={{ width: 60 }} />
                </View>
                <View style={styles.monthGrid}>
                  {MONTHS.map((m, idx) => {
                    const isSel = idx === viewMonth;
                    return (
                      <Pressable
                        key={m}
                        style={[styles.monthItem, isSel && styles.monthItemSelected]}
                        onPress={() => { setViewMonth(idx); setMode("calendar"); }}
                      >
                        <Text style={[styles.monthItemText, isSel && styles.monthItemTextSelected]}>
                          {MONTHS_SHORT[idx]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* YEAR PICKER MODE */}
            {mode === "year" && (
              <>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={() => setMode("calendar")} hitSlop={12} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={18} color={Colors.accent} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                  <Text style={styles.pickerTitle}>Select Year</Text>
                  <View style={{ width: 60 }} />
                </View>
                <FlatList
                  ref={yearListRef}
                  data={YEARS}
                  keyExtractor={(item) => String(item)}
                  style={styles.yearList}
                  getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
                  initialScrollIndex={Math.max(0, selectedYearIndex - 3)}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSel = item === viewYear;
                    return (
                      <Pressable
                        style={[styles.yearItem, isSel && styles.yearItemSelected]}
                        onPress={() => { setViewYear(item); setMode("calendar"); }}
                      >
                        <Text style={[styles.yearItemText, isSel && styles.yearItemTextSelected]}>
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

const CELL_SIZE = 38;

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
  navArrow: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerChipText: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeader: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    color: Colors.textSec,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellInner: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { backgroundColor: Colors.accent },
  cellToday: { backgroundColor: Colors.accent + "22" },
  cellText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: "DMSans_400Regular",
  },
  cellTextSelected: { color: Colors.white, fontFamily: "DMSans_700Bold" },
  cellTextToday: { color: Colors.accent, fontFamily: "DMSans_700Bold" },
  shortcuts: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
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
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    width: 60,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.accent,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  monthItem: {
    width: "22%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexGrow: 1,
  },
  monthItemSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  monthItemText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.text,
  },
  monthItemTextSelected: {
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
  yearList: { maxHeight: 260 },
  yearItem: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginVertical: 2,
  },
  yearItemSelected: { backgroundColor: Colors.accent },
  yearItemText: {
    fontSize: 17,
    fontFamily: "DMSans_400Regular",
    color: Colors.text,
  },
  yearItemTextSelected: {
    color: Colors.white,
    fontFamily: "DMSans_700Bold",
  },
});
