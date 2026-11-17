import React from "react";
import { Dimensions, View } from "react-native";
import { Trash2, CheckCircle2 } from "lucide-react-native";
import { toast } from "@/lib/toast";
import { AppImage, Text } from "@/native/ui";
import { colors, shadow } from "@/theme";
import { markBrandToastShown } from "./toastGuard";

/** Foodie web: the toasts lead with /logo-icon.webp (the square Foodie icon) in a rounded box (h-12 / h-14). */
const FOODIE_ICON = require("../../assets/public/images/logo-icon.webp");
export const BrandToastIcon = ({ size = "lg" }) => {
  const box = size === "md" ? 48 : size === "sm" ? 40 : 56;
  return (
    <View accessibilityLabel="Foodie Delivery Partner" style={{ width: box, height: box, borderRadius: 16, overflow: "hidden", flexShrink: 0 }}>
      <AppImage src={FOODIE_ICON} contentFit="contain" style={{ width: box, height: box }} />
    </View>
  );
};

const NOTIF_TOAST_ID = "app-notification-toast";
const toastWidth = () => Dimensions.get("window").width - 32;

const cardStyle = {
  backgroundColor: colors.white,
  borderRadius: 24,
  flexDirection: "row",
  alignItems: "center",
  gap: 16,
  padding: 14,
  borderWidth: 1,
  borderColor: colors.gray[50],
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

export const showNotificationToast = ({ title, message } = {}) => {
  markBrandToastShown(6000);
  toast.dismiss(NOTIF_TOAST_ID);
  toast.custom(
    () => (
      <View style={[cardStyle, { width: toastWidth() }]}>
        <BrandToastIcon size="md" />
        <View style={{ flex: 1, paddingRight: 4, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 16, fontWeight: "700", color: colors.gray[900] }}>
            {title || "Notification"}
          </Text>
          {message ? (
            <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, fontWeight: "500", color: colors.gray[500], marginTop: 2 }}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    ),
    { id: NOTIF_TOAST_ID, duration: 6000, position: "top-center" },
  );
};

export const showFoodieBrandedToast = ({ title, message, id = "foodie-branded-toast", duration = 4000 } = {}) => {
  markBrandToastShown(duration);
  toast.custom(
    () => (
      <View style={[cardStyle, { width: toastWidth() }]}>
        <BrandToastIcon />
        <View style={{ flex: 1, paddingRight: 8, minWidth: 0 }}>
          <Text style={{ fontSize: 14, lineHeight: 17, fontWeight: "700", color: colors.gray[800] }}>{title}</Text>
          {message ? <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.gray[500], marginTop: 4 }}>{message}</Text> : null}
        </View>
      </View>
    ),
    { id, duration, position: "top-center" },
  );
};

export const showAddressRemovedToast = () => {
  showFoodieBrandedToast({
    title: "Address Removed Successfully",
    id: "address-removed-toast",
  });
};

export const showAccountDeletedToast = () => {
  toast.custom(
    () => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: "#f0fdf4",
          borderWidth: 1,
          borderColor: "#bbf7d0",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          minWidth: 300,
          ...shadow.lg,
        }}
      >
        <View>
          <Trash2 size={24} color="#ef4444" />
          <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: colors.white, borderRadius: 999 }}>
            <CheckCircle2 size={14} color={colors.white} fill="#22c55e" />
          </View>
        </View>
        <Text style={{ color: "#15803d", fontWeight: "700", fontSize: 14, lineHeight: 20 }}>Account Deleted successfully</Text>
      </View>
    ),
    { duration: 4000 },
  );
};
