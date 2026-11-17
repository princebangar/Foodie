// Web: modules/Food/utils/flyToCart.js — flies a round dish photo from the tapped ADD / + button into the cart pill
// along an arc (24 keyframes: control point above the line, scale 1 -> 1.24 -> ~0.73, fade out after 90 %), 650 ms,
// cubic-bezier(0.45, 0, 0.25, 1).
// The web appended a fixed <div> to <body> and ran the Web Animations API. Here flyToCart() hands the flight to
// <FlyToCartHost /> (mounted once above every screen, appstore/AppShell) which draws it with Animated on the native
// thread. Points are window coordinates (measureInWindow / pageX); the app has no page scroll to correct for.
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"
import { AppImage } from "@/native/ui"
import dishFallbackImage from "@food/assets/placeholders/dish_fallback.webp"

const FLY_SIZE_PX = 36
const ARC_STEPS = 24
export const FLY_DURATION_MS = 650
/** Point in the flight (ms) where the photo reaches the target and starts fading out. */
export const FLY_ARRIVE_MS = Math.round(FLY_DURATION_MS * 0.85)

let hostListener = null
let flightSeq = 0

/** Flies a dish photo from `from` to `to` ({ x, y } window points). Resolves when the photo has landed. */
export function flyToCart({ image, from, to, size = FLY_SIZE_PX }) {
  if (!from || !to || !hostListener) return Promise.resolve()
  return new Promise((resolve) => {
    hostListener({ id: ++flightSeq, image, from, to, size, done: resolve })
  })
}

/**
 * Web: true when the element is laid out on screen (pages kept alive in a hidden tab must not launch a flight).
 * Native: the caller passes whether it is the shown screen (e.g. Home's isTabActive).
 */
export function isShownOnScreen(shown) {
  return Boolean(shown)
}

/** Window point of a captured add-button position ({ viewportX, viewportY }). */
export function sourceToViewportPoint(source) {
  if (!source || source.viewportX === undefined) return null
  return { x: Number(source.viewportX) || 0, y: Number(source.viewportY) || 0 }
}

// keyframe table of the web flight, as Animated interpolations over t = 0..1
function arcFrames(from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const cx = dx * 0.35
  const cy = Math.min(0, dy) - Math.max(80, Math.abs(dx) * 0.4)
  const input = [], xs = [], ys = [], scales = [], opacity = []
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const t = i / ARC_STEPS
    const u = 1 - t
    input.push(t)
    xs.push(2 * u * t * cx + t * t * dx)
    ys.push(2 * u * t * cy + t * t * dy)
    scales.push(t < 0.15 ? 1 + t * 1.6 : 1.24 - (t - 0.15) * 0.6)
    opacity.push(t > 0.9 ? (1 - t) * 10 : 1)
  }
  return { input, xs, ys, scales, opacity }
}

function Flight({ flight, onEnd }) {
  const t = useRef(new Animated.Value(0)).current
  const [frames] = useState(() => arcFrames(flight.from, flight.to))
  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: FLY_DURATION_MS,
      easing: Easing.bezier(0.45, 0, 0.25, 1),
      useNativeDriver: true,
    })
    anim.start(() => onEnd(flight))
    return () => anim.stop()
  }, [t, flight, onEnd])
  const half = flight.size / 2
  const map = (outputRange) => t.interpolate({ inputRange: frames.input, outputRange })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.photo,
        {
          left: flight.from.x - half,
          top: flight.from.y - half,
          width: flight.size,
          height: flight.size,
          opacity: map(frames.opacity),
          transform: [{ translateX: map(frames.xs) }, { translateY: map(frames.ys) }, { scale: map(frames.scales) }],
        },
      ]}
    >
      <AppImage src={flight.image || dishFallbackImage} fallback={dishFallbackImage} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  )
}

/** Draws the flights started with flyToCart(). Mount once, above every screen. */
export function FlyToCartHost() {
  const [flights, setFlights] = useState([])
  useEffect(() => {
    hostListener = (flight) => setFlights((list) => [...list, flight])
    return () => {
      hostListener = null
    }
  }, [])
  const onEnd = useRef((flight) => {
    flight.done()
    setFlights((list) => list.filter((f) => f.id !== flight.id))
  }).current
  if (!flights.length) return null
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 12000, elevation: 60 }]}>
      {flights.map((f) => (
        <Flight key={f.id} flight={f} onEnd={onEnd} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  photo: {
    position: "absolute",
    borderRadius: 9999,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
})
