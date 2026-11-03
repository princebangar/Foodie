import React, { useState, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Loader2, BadgeCheck, Phone, Bike, CalendarDays, Hash, ShieldCheck } from "lucide-react-native";
import { toast } from "@/lib/toast";
import { AppImage, Screen, Text } from "@/native/ui";
import { StatusBar } from "@/native/ui/SectionStatusBar";
import { alpha, colors, shadow } from "@/theme";
import { deliveryAPI } from "@food/api";
import { useCompanyName } from "@food/hooks/useCompanyName";
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation";

const PRIMARY = "#15498B";
// web /assets/images/profile_avatar.webp, bundled so it shows offline
const DEFAULT_AVATAR = require("../../../../assets/public/images/profile_avatar.webp");

function Spinner({ color, size }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

export default function ShowIdCardV2() {
  const companyName = useCompanyName();
  const goBack = useDeliveryBackNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  // Fetch delivery partner profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getProfile();

        if (response?.data?.success && response?.data?.data?.profile) {
          setProfileData(response.data.data.profile);
        } else {
          toast.error("Failed to load profile data");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load ID card data");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Format date for validity
  const formatValidDate = () => {
    if (!profileData?.createdAt) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const createdDate = new Date(profileData.createdAt);
    const validTill = new Date(createdDate);
    validTill.setFullYear(validTill.getFullYear() + 1);
    return validTill.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Get status display
  const getStatusDisplay = () => {
    if (!profileData) return "Active";
    const status = profileData.status?.toLowerCase() || (profileData.isActive ? 'active' : 'inactive');
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Status chip colours (web: inline styles, so the delivery theme cannot repaint them)
  const getStatusTone = () => {
    const status = profileData?.status?.toLowerCase() || (profileData?.isActive ? 'active' : 'inactive');
    if (status === 'active' || status === 'approved') return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", verified: true };
    if (status === 'pending') return { bg: "#fef9c3", text: "#a16207", border: "#fde68a", verified: false };
    if (status === 'suspended' || status === 'blocked' || status === 'rejected') return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca", verified: false };
    return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", verified: false };
  };

  const getProfileImageUrl = () => {
    if (profileData?.profileImage?.url) return profileData.profileImage.url;
    if (profileData?.documents?.photo) return profileData.documents.photo;
    return DEFAULT_AVATAR;
  };

  // Get vehicle display text
  const getVehicleDisplay = () => {
    if (!profileData?.vehicle) return null;
    const vehicle = profileData.vehicle;
    const parts = [];
    if (vehicle.type) parts.push(vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1));
    if (vehicle.number) parts.push(vehicle.number);
    return parts.length > 0 ? parts.join(" - ") : null;
  };

  if (loading) {
    return (
      <Screen bg={colors.gray[100]}>
        <View style={styles.center}>
          <View style={{ alignItems: "center", gap: 16 }}>
            <Spinner size={32} color={colors.gray[600]} />
            <Text style={{ color: colors.gray[600], fontSize: 16 }}>Loading ID card...</Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (!profileData) {
    return (
      <Screen bg={colors.gray[100]}>
        <View style={styles.center}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: colors.gray[600], marginBottom: 16, fontSize: 16 }}>Failed to load ID card data</Text>
            <Pressable onPress={goBack} style={styles.goBackBtn}>
              <Text style={{ color: colors.white, fontSize: 16 }}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  const idCardData = {
    name: profileData.name || "Delivery Partner",
    id: profileData.deliveryId || profileData._id?.toString().slice(-8).toUpperCase() || "N/A",
    phone: profileData.phone || "N/A",
    status: getStatusDisplay(),
    statusTone: getStatusTone(),
    validTill: formatValidDate(),
    vehicle: getVehicleDisplay(),
    profileImage: getProfileImageUrl()
  };

  const details = [
    { label: "Partner ID", value: idCardData.id, Icon: Hash },
    { label: "Mobile", value: idCardData.phone, Icon: Phone },
    idCardData.vehicle ? { label: "Vehicle", value: idCardData.vehicle, Icon: Bike } : null,
    { label: "Valid till", value: idCardData.validTill, Icon: CalendarDays },
  ].filter(Boolean);

  const tone = idCardData.statusTone;
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 16, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
        bounces={false}
      >
        <View style={styles.wrap}>
          <View style={styles.topRow}>
            <Text style={styles.title}>My ID Card</Text>
            <Pressable onPress={goBack} accessibilityLabel="Close" style={({ pressed }) => [styles.close, pressed && { transform: [{ scale: 0.95 }] }]}>
              <X size={20} color={INK} />
            </Pressable>
          </View>

          <View style={styles.card}>
            {/* Header band */}
            <LinearGradient colors={["#15498b", "#0b2a52"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.band}>
              <View style={styles.bubbleA} />
              <View style={styles.bubbleB} />
              <View style={styles.bandRow}>
                <View>
                  <Text style={styles.brand}>{String(companyName || "").toUpperCase()}</Text>
                  <Text style={styles.brandSub}>DELIVERY PARTNER ID</Text>
                </View>
                <ShieldCheck size={28} color={alpha("#ffffff", 0.85)} />
              </View>
            </LinearGradient>

            {/* Photo */}
            <View style={styles.photoRow}>
              <View style={styles.avatarRing}>
                <AppImage src={idCardData.profileImage} fallback={DEFAULT_AVATAR} style={styles.avatar} contentFit="cover" accessibilityLabel={idCardData.name} />
              </View>
            </View>

            {/* Name + status */}
            <View style={styles.nameBlock}>
              <Text style={styles.name}>{idCardData.name.toUpperCase()}</Text>
              <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                {tone.verified ? (
                  <BadgeCheck size={16} color={tone.text} />
                ) : (
                  <View style={[styles.chipDot, { backgroundColor: tone.text }]} />
                )}
                <Text style={[styles.chipText, { color: tone.text }]}>{idCardData.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.details}>
              {details.map(({ label, value, Icon }, i) => (
                <View key={label} style={[styles.detailRow, i > 0 && { borderTopWidth: 1, borderTopColor: LINE }]}>
                  <View style={styles.detailIcon}>
                    <Icon size={16} color={PRIMARY} />
                  </View>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{String(value).toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Footer */}
            <Text style={styles.footer}>This ID card is issued for essential delivery services only.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const PAGE_BG = "#eef3fb";
const INK = "#0f1724";
const LINE = "#e3eaf5";

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  goBackBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  wrap: { width: "100%", maxWidth: 384 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: INK },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d1dceb", ...shadow.sm },
  card: { backgroundColor: colors.white, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: LINE, elevation: 8, shadowColor: "#112743", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 18 } },
  band: { height: 128, overflow: "hidden" },
  bubbleA: { position: "absolute", right: -40, top: -48, width: 160, height: 160, borderRadius: 80, backgroundColor: alpha("#ffffff", 0.08) },
  bubbleB: { position: "absolute", left: -32, bottom: -60, width: 144, height: 144, borderRadius: 72, backgroundColor: alpha("#ffffff", 0.06) },
  bandRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16 },
  brand: { fontSize: 15, lineHeight: 22, fontWeight: "900", letterSpacing: 2.7, color: colors.white },
  brandSub: { fontSize: 10, lineHeight: 14, fontWeight: "600", letterSpacing: 2, color: alpha("#ffffff", 0.7) },
  photoRow: { alignItems: "center", marginTop: -56 },
  avatarRing: { padding: 4, backgroundColor: colors.white, borderRadius: 9999, elevation: 6, shadowColor: "#112743", shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: "#e7effa" },
  nameBlock: { alignItems: "center", paddingHorizontal: 20, marginTop: 12 },
  name: { fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.5, color: INK, textAlign: "center" },
  chip: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 11, lineHeight: 16, fontWeight: "700", letterSpacing: 1.5 },
  details: { marginHorizontal: 20, marginTop: 20, borderRadius: 20, overflow: "hidden", backgroundColor: "#f5f8fd", borderWidth: 1, borderColor: LINE },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  detailIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#e7effa" },
  detailLabel: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: "#4f5f77" },
  detailValue: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "700", color: INK, textAlign: "right" },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, textAlign: "center", fontSize: 11, lineHeight: 18, fontWeight: "500", color: "#7a889c" },
});
