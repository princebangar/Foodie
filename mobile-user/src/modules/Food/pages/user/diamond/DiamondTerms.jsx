// Web: modules/Food/pages/user/diamond/DiamondTerms.jsx — admin-written Foodie Diamond terms (GET diamond terms).
// Plain text: blank lines split paragraphs, "1. Heading" lines become headings, lines starting "-" or "•" bullets.
import React, { useEffect, useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, Loader2 } from "lucide-react-native"
import { useNavigate } from "@/lib/router"
import { ForceLight, colors } from "@/theme"
import { Text } from "@/native/ui"
import { StatusBar } from "@/native/ui/SectionStatusBar"
import { Spin } from "@/shared/components/Loader"
import { userAPI } from "@food/api"
import { DIAMOND_FONT } from "@food/components/user/diamond/DiamondBrand"

const body = { fontFamily: DIAMOND_FONT, fontSize: 15, lineHeight: 24, color: colors.gray[700] }

function Bullets({ items }) {
  return (
    <View style={{ gap: 6, paddingLeft: 4 }}>
      {items.map((l, j) => (
        <View key={j} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={body}>•</Text>
          <Text style={[body, { flex: 1 }]}>{l.replace(/^[-•*]\s+/, "")}</Text>
        </View>
      ))}
    </View>
  )
}

function TermsText({ text }) {
  const blocks = String(text || "").trim().split(/\n\s*\n/)
  return (
    <View style={{ gap: 16 }}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
        if (lines.length && /^\d+\.\s+\S/.test(lines[0]) && lines[0].length < 70) {
          const rest = lines.slice(1)
          return (
            <View key={i} style={{ gap: 8 }}>
              <Text style={{ fontFamily: DIAMOND_FONT, paddingTop: 8, fontSize: 16, lineHeight: 24, fontWeight: "600", color: colors.gray[900] }}>{lines[0]}</Text>
              {rest.length > 0 && <Bullets items={rest} />}
            </View>
          )
        }
        if (lines.every((l) => /^[-•*]\s+/.test(l))) return <Bullets key={i} items={lines} />
        return (
          <Text key={i} style={body}>
            {lines.join("\n")}
          </Text>
        )
      })}
    </View>
  )
}

function DiamondTermsContent() {
  const navigate = useNavigate()
  const insets = useSafeAreaInsets()
  const [terms, setTerms] = useState(null)

  useEffect(() => {
    userAPI
      .getDiamondTerms()
      .then((res) => setTerms(res?.data?.data?.terms || ""))
      .catch(() => setTerms(""))
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top,
          height: 56 + insets.top,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[100],
          backgroundColor: colors.white,
          paddingHorizontal: 12,
        }}
      >
        <Pressable onPress={() => navigate(-1)} accessibilityLabel="Back" style={({ pressed }) => [{ borderRadius: 9999, padding: 6 }, pressed && { backgroundColor: colors.gray[100] }]}>
          <ArrowLeft size={24} color={colors.gray[900]} strokeWidth={1.75} />
        </Pressable>
        <Text style={{ fontFamily: DIAMOND_FONT, fontSize: 19, lineHeight: 24, fontWeight: "600", color: colors.gray[900] }}>Terms and Conditions</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 24 + insets.bottom }}>
        <Text style={{ fontFamily: DIAMOND_FONT, marginBottom: 16, fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.gray[900] }}>Foodie Diamond</Text>
        {terms === null ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Spin>
              <Loader2 size={24} color={colors.gray[400]} />
            </Spin>
          </View>
        ) : terms.trim() ? (
          <TermsText text={terms} />
        ) : (
          <Text style={{ fontFamily: DIAMOND_FONT, fontSize: 15, lineHeight: 22, color: colors.gray[500] }}>Terms will be published soon.</Text>
        )}
      </ScrollView>
    </View>
  )
}

// The web page has no dark variant (bg-white): always light.
export default function DiamondTerms() {
  return (
    <ForceLight>
      <DiamondTermsContent />
    </ForceLight>
  )
}
