// Web: modules/Food/pages/shared/MaintenancePage.jsx — full-screen Under Maintenance UI: the maintenance banner as a
// full-bleed wallpaper covering the whole screen (object-cover, centred). The web also set document.title; the app
// has no tab title.
import React from "react";
import { StyleSheet, View } from "react-native";
import { AppImage } from "@/native/ui";
import { StatusBar } from "@/native/ui/SectionStatusBar";
import { MAINTENANCE_CONTENT } from "@food/constants/maintenanceContent";
import maintenanceHero from "@food/assets/illustrations/maintenance-hero.png";

export default function MaintenancePage({ content = MAINTENANCE_CONTENT } = {}) {
  const title = content?.title || MAINTENANCE_CONTENT.title;
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AppImage src={maintenanceHero} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 9999, elevation: 9999, overflow: "hidden", backgroundColor: "#ffffff" },
});
