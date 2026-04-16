/**
 * LogbookLogo
 * -----------
 * Renders the app name wordmark, optionally with the icon mark.
 *
 * Usage:
 *   <LogbookLogo size={48} />                    — icon only
 *   <LogbookLogo size={36} showName />           — icon + "Logbook" wordmark
 *   <LogbookLogo size={36} showName hideIcon />  — wordmark only (no icon)
 */
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  size?: number;
  showName?: boolean;
  hideIcon?: boolean;
  textColor?: string;
}

export function LogbookLogo({ size = 40, showName = false, hideIcon = false, textColor }: Props) {
  const C = useColors();
  const radius = size * 0.22;
  const textCol    = textColor ?? C.text;
  const textSecCol = C.textSec;

  return (
    <View style={styles.root}>
      {!hideIcon && (
        <Image
          source={require("@/assets/images/icon.png")}
          style={[
            styles.icon,
            { width: size, height: size, borderRadius: radius },
          ]}
          resizeMode="cover"
        />
      )}
      {showName && (
        <View style={[styles.nameWrap, hideIcon && { marginLeft: 0 }]}>
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
