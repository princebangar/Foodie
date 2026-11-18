// Web: modules/Food/components/user/diamond/DiamondBrand.jsx — Foodie Diamond visual language: dark base, icy-blue
// "diamond" metal for the wordmark and accents. Same exports.
// The web painted the metal on text with background-clip: text. Native text cannot be clipped to a gradient, so
// <DiamondMetalText> draws the word as SVG text filled with the same gradient; `diamondTextStyle` (used on words inside
// a sentence) is the ice colour of that gradient.
import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Defs, G, LinearGradient as SvgLinearGradient, Path, Stop, Text as SvgText } from "react-native-svg"
import { AppImage, Text } from "@/native/ui"
import { fonts } from "@/theme"
import foodieWordmark from "@food/assets/diamond/foodie-wordmark-white.webp"

// Prince (18 Nov): first near-black (#0B0E13, "all black"), then saturated sapphire ("too blue, looks like AI"). Now
// a calm slate navy: clearly blue next to the app's black / white, but muted. One solid colour, no gradients; the
// Profile card uses the same DIAMOND_BG as the Diamond page.
export const DIAMOND_BG = "#1B2838"
export const DIAMOND_CARD = "#253649"
export const DIAMOND_ICE = "#9EE6FF"
export const DIAMOND_ICE_SOFT = "#CDEFFC"
/** web: 'Outfit', 'Figtree', sans-serif */
export const DIAMOND_FONT = fonts.outfit

/** Metallic ice gradient (stops of the web's linear-gradient(180deg, ...)). */
export const DIAMOND_METAL_STOPS = [
  ["0", "#F4FDFF"],
  ["0.38", "#BDEFFF"],
  ["0.52", "#5CC6EE"],
  ["0.68", "#A8E6FA"],
  ["1", "#EAFBFF"],
]
export const DIAMOND_METAL = DIAMOND_METAL_STOPS.map(([, c]) => c)
export const DIAMOND_METAL_LOCATIONS = DIAMOND_METAL_STOPS.map(([o]) => Number(o))

/** Soft fill for buttons and pills (linear-gradient(135deg, #E6F9FF, #B4EBFC, #D2F3FE)). */
export const DIAMOND_BUTTON = ["#E6F9FF", "#B4EBFC", "#D2F3FE"]

/** Words inside a sentence: the ice colour of the metal (native text cannot be clipped to the gradient). */
export const diamondTextStyle = { color: "#BDEFFF" }

let gradSeq = 0

/** A line of text painted with the metal gradient (web: diamondTextStyle on a heading). */
export function DiamondMetalText({ children, style }) {
  const flat = StyleSheet.flatten(style) || {}
  const fontSize = flat.fontSize || 16
  const [size, setSize] = useState(null)
  const [id] = useState(() => `dm-${++gradSeq}`)
  const text = String(children ?? "")
  return (
    <View style={{ alignSelf: flat.alignSelf || "flex-start" }}>
      {/* measures the word in the same font; invisible, the SVG on top paints it */}
      <Text style={[style, { opacity: 0 }]} onLayout={(e) => setSize(e.nativeEvent.layout)}>
        {text}
      </Text>
      {size ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgLinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              {DIAMOND_METAL_STOPS.map(([o, c]) => (
                <Stop key={o} offset={o} stopColor={c} />
              ))}
            </SvgLinearGradient>
          </Defs>
          <SvgText
            x={flat.textAlign === "center" ? size.width / 2 : 0}
            y={size.height / 2 + fontSize * 0.35}
            textAnchor={flat.textAlign === "center" ? "middle" : "start"}
            fill={`url(#${id})`}
            fontSize={fontSize}
            fontWeight={flat.fontWeight || "900"}
            fontFamily={flat.fontFamily || DIAMOND_FONT}
            letterSpacing={flat.letterSpacing || 0}
          >
            {text}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  )
}

/** Faceted brilliant-cut gem. `size` (or style width/height) replaces the web's className h-6 w-6. */
export function DiamondGem({ size = 24, style, id = "gem" }) {
  return (
    <Svg viewBox="0 0 64 56" width={size} height={(size * 56) / 64} style={style}>
      <Defs>
        <SvgLinearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F2FCFF" />
          <Stop offset="1" stopColor="#7FD6F5" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B9EEFF" />
          <Stop offset="1" stopColor="#2E9FD0" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${id}-c`} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DDF7FF" />
          <Stop offset="1" stopColor="#4BB8E6" />
        </SvgLinearGradient>
      </Defs>
      <Path d="M16 2h32l14 16H2z" fill={`url(#${id}-a)`} />
      <Path d="M16 2l8 16h16l8-16z" fill="#FFFFFF" opacity={0.55} />
      <Path d="M2 18h60L32 54z" fill={`url(#${id}-b)`} />
      <Path d="M24 18h16L32 54z" fill={`url(#${id}-c)`} />
      <Path d="M2 18h22l8 36z" fill="#1F7FAE" opacity={0.35} />
      <Path d="M16 2L2 18h22z M48 2l14 16H40z" fill="#FFFFFF" opacity={0.25} />
    </Svg>
  )
}

/** "Foodie" over "DIAMOND", the O drawn as a gem in a ring. */
export function DiamondWordmark({ size = "lg" }) {
  const big = size === "lg"
  const letterSize = big ? 68 : 34
  const ring = big ? 53 : 27
  const letter = { fontSize: letterSize, lineHeight: letterSize, fontWeight: "900", letterSpacing: -0.02 * letterSize, fontFamily: DIAMOND_FONT }
  const [ringId] = useState(() => `ring-${++gradSeq}`)
  return (
    <View style={{ alignItems: "center" }}>
      <AppImage src={foodieWordmark} contentFit="contain" style={{ height: big ? 52 : 27, width: ((big ? 52 : 27) * 720) / 232 }} />
      <View style={{ marginTop: big ? 6 : 4, flexDirection: "row", alignItems: "center" }}>
        <DiamondMetalText style={letter}>DIAM</DiamondMetalText>
        <View style={{ width: ring, height: ring, marginHorizontal: big ? 2 : 1, alignItems: "center", justifyContent: "center" }}>
          <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
                {DIAMOND_METAL_STOPS.map(([o, c]) => (
                  <Stop key={o} offset={o} stopColor={c} />
                ))}
              </SvgLinearGradient>
            </Defs>
            <G>
              <Path
                d={`M ${ring / 2} 0 A ${ring / 2} ${ring / 2} 0 1 1 ${ring / 2 - 0.01} 0 Z`}
                fill={`url(#${ringId})`}
              />
            </G>
          </Svg>
          <View style={{ width: ring * 0.78, height: ring * 0.78, borderRadius: 9999, backgroundColor: DIAMOND_BG, alignItems: "center", justifyContent: "center" }}>
            <DiamondGem size={ring * 0.78 * 0.58} id={`wm-${size}`} />
          </View>
        </View>
        <DiamondMetalText style={letter}>ND</DiamondMetalText>
      </View>
    </View>
  )
}

/**
 * Faint faceted lines. `corner` keeps them in the top-right corner only (the web faded them out with a radial mask;
 * here only the facets near the top-right corner are drawn, fading with distance).
 */
export function DiamondPattern({ style, corner = false }) {
  const paths = []
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const x = col * 64 + (row % 2 ? 32 : 0) - 16
      const y = row * 56 - 10
      let opacity = corner ? 0.22 : 0.09
      if (corner) {
        const dx = (400 - (x + 20)) / (400 * 0.62)
        const dy = (y + 20) / (300 * 1.05)
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > 0.78) continue
        opacity *= d < 0.45 ? 1 - d / 0.9 : 0.5 * (1 - (d - 0.45) / 0.33)
      }
      paths.push(
        <Path
          key={`${row}-${col}`}
          d={`M${x} ${y + 14}l12-14h16l12 14-20 24z M${x + 12} ${y}l8 14 8-14`}
          strokeOpacity={Math.max(0, opacity)}
        />,
      )
    }
  }
  return (
    <Svg pointerEvents="none" style={[StyleSheet.absoluteFill, style]} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <G fill="none" stroke="#8FD9F5" strokeWidth={1.2}>
        {paths}
      </G>
    </Svg>
  )
}

export const formatINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

/** "22nd Dec 2026" */
export const formatMemberDate = (value) => {
  if (!value) return ""
  const d = new Date(value)
  const day = d.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th"
  return `${day}${suffix} ${d.toLocaleDateString("en-IN", { month: "short" })} ${d.getFullYear()}`
}
