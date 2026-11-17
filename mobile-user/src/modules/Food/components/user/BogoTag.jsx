// Web: modules/Food/components/user/BogoTag.jsx — "Buy 1 Get 1 Free" offer tag under the price on dish cards that have
// an active BOGO offer (rounded-md bg-[#256fef]/10 px-2 py-0.5 text-[11px] font-extrabold uppercase, dark: /20 + #7aa7ff).
import React from "react"
import { View } from "react-native"
import { BadgePercent } from "lucide-react-native"
import { Text } from "@/native/ui"
import { alpha, useTheme } from "@/theme"

export default function BogoTag({ style }) {
  const t = useTheme()
  const color = t.dark ? "#7aa7ff" : "#256fef"
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: 6,
          backgroundColor: alpha("#256fef", t.dark ? 0.2 : 0.1),
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <BadgePercent size={13} color={color} strokeWidth={2.5} />
      <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 16, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.275, color }}>
        Buy 1 Get 1 Free
      </Text>
    </View>
  )
}
