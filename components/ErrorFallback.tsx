import React, { useState, useMemo } from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  Modal,
  useColorScheme,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

/** Stable short reference ID derived from the error message so users can quote
 *  it to support without exposing a raw stack trace in production. */
function makeErrorRef(error: Error): string {
  let hash = 0;
  const str = error.message + (error.name ?? "");
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return "ERR-" + Math.abs(hash).toString(16).toUpperCase().padStart(6, "0");
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const theme = {
    background: isDark ? "#000000" : "#FFFFFF",
    backgroundSecondary: isDark ? "#1C1C1E" : "#F2F2F7",
    text: isDark ? "#FFFFFF" : "#000000",
    textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
    textFaint: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)",
    link: "#007AFF",
    buttonText: "#FFFFFF",
    errorBg: isDark ? "#2C1A1A" : "#FFF1F0",
    errorText: isDark ? "#FF6B6B" : "#C0392B",
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const errorRef = useMemo(() => makeErrorRef(error), [error]);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Dev-only: quick access to full stack trace */}
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          accessibilityLabel="View error details"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.topButton,
            {
              top: insets.top + 16,
              backgroundColor: theme.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="alert-circle" size={20} color={theme.text} />
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <Feather name="alert-triangle" size={48} color="#FF9500" />

        <Text style={[styles.title, { color: theme.text }]}>
          Something went wrong
        </Text>

        <Text style={[styles.message, { color: theme.textSecondary }]}>
          The app ran into an unexpected problem. Restarting usually fixes it.
          If it keeps happening, contact support and quote the reference below.
        </Text>

        {/* Error summary visible in production — no raw stack trace */}
        <View style={[styles.errorSummary, { backgroundColor: theme.errorBg }]}>
          <Text style={[styles.errorType, { color: theme.errorText, fontFamily: monoFont }]}>
            {error.name ?? "Error"}
          </Text>
          <Text
            style={[styles.errorMessage, { color: theme.errorText, fontFamily: monoFont }]}
            numberOfLines={3}
            selectable
          >
            {error.message || "An unknown error occurred."}
          </Text>
        </View>

        {/* Reference ID users can quote to support */}
        <View style={[styles.refRow, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.refLabel, { color: theme.textFaint }]}>Reference</Text>
          <Text style={[styles.refValue, { color: theme.textSecondary, fontFamily: monoFont }]} selectable>
            {errorRef}
          </Text>
        </View>

        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.link,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Restart the app"
        >
          <Feather name="refresh-cw" size={16} color={theme.buttonText} style={styles.buttonIcon} />
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Restart App</Text>
        </Pressable>

        {/* Dev-only: secondary button to open full stack trace modal */}
        {__DEV__ ? (
          <Pressable
            onPress={() => setIsModalVisible(true)}
            style={({ pressed }) => [styles.ghostButton, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="View full stack trace"
          >
            <Text style={[styles.ghostButtonText, { color: theme.link }]}>View stack trace</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Dev-only: full stack trace modal */}
      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: theme.background },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Error Details
                </Text>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  accessibilityLabel="Close error details"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.closeButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 16 },
                ]}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.errorContainer,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.errorText,
                      {
                        color: theme.text,
                        fontFamily: monoFont,
                      },
                    ]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 480,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 40,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  errorSummary: {
    width: "100%",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  errorType: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  refRow: {
    width: "100%",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  refValue: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  topButton: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    paddingHorizontal: 24,
    minWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonIcon: {
    marginRight: 2,
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
  ghostButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  errorContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
  },
});
