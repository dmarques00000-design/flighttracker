/**
 * LogbookLogo
 * -----------
 * Renders the real app icon (assets/images/icon.png) as the in-app logo mark.
 *
 * Usage:
 *   <LogbookLogo size={48} />           — icon only
 *   <LogbookLogo size={36} showName />  — icon + "Logbook" wordmark
 */
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

interface Props {
  size?: number;
  showName?: boolean;
  textColor?: string;
}

export function LogbookLogo({ size = 40, showName = false, textColor }: Props) {
  const radius = size * 0.22;
  const textCol    = textColor ?? Colors.text;
  const textSecCol = Colors.textSec;

  return (
    <View style={styles.root}>
      <Image
        source={require("@/assets/images/icon.png")}
        style={[
          styles.icon,
          { width: size, height: size, borderRadius: radius },
        ]}
        resizeMode="cover"
      />
      {showName && (
        <View style={styles.nameWrap}>
          <Text style={[styles.name, { color: textCol, fontSize: size * 0.72 }]}>
            Logbook
          </Text>
          <Text style={[styles.sub, { color: textSecCol, fontSize: size * 0.30 }]}>
            Flight Journal
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flexDirection: "row", alignItems: "center" },
  icon:     { overflow: "hidden" },
  nameWrap: { marginLeft: 10, justifyContent: "center" },
  name:     { fontFamily: "DMSans_700Bold" },
  sub:      { fontFamily: "DMSans_400Regular", marginTop: 1 },
});

export default LogbookLogo;
