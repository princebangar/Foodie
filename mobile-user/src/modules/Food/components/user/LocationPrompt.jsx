// Web: modules/Food/components/user/LocationPrompt.jsx — location permission is mandatory: the "Enable Location
// Services" card comes back on every screen until it is granted. Closing it only hides it for the current screen;
// header location buttons open it on demand (openLocationPromptIfNeeded). Mounted by UserLayout.
// The web asked navigator.permissions for "geolocation"; the app asks expo-location for its foreground permission
// (granted / denied without asking again / not asked yet -> "granted" / "denied" / "prompt").
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native"
import { BlurView } from "expo-blur"
import * as ExpoLocation from "expo-location"
import { MapPin, X } from "lucide-react-native"
import { useNavigate, useLocation as useRouterLocation } from "@/lib/router"
import { Text } from "@/native/ui"
import { Spin } from "@/shared/components/Loader"
import { alpha, colors, makeStyles, useTheme } from "@/theme"
import { useLocation, isLocationPermissionGranted } from "@food/hooks/useLocation"

export const OPEN_LOCATION_PROMPT_EVENT = "food:open-location-prompt"

/** Opens the prompt when location permission is not granted. Returns true if it was opened. */
export const openLocationPromptIfNeeded = () => {
  if (isLocationPermissionGranted()) return false
  window.dispatchEvent(new CustomEvent(OPEN_LOCATION_PROMPT_EVENT))
  return true
}

const queryBrowserPermission = async () => {
  try {
    const res = await ExpoLocation.getForegroundPermissionsAsync()
    if (res?.granted) return "granted"
    if (res?.canAskAgain === false) return "denied"
    return "prompt"
  } catch {
    return null
  }
}

function Ping({ color }) {
  // animate-ping: scale 1 -> 2, opacity 1 -> 0, 1 s, forever
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [v])
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 9999,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
        },
      ]}
    />
  )
}

export default function LocationPrompt() {
  const navigate = useNavigate()
  const { pathname } = useRouterLocation()
  const { loading, requestLocation } = useLocation()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const s = useStyles()
  const t = useTheme()
  const enter = useRef(new Animated.Value(0)).current

  const isAddressSelector = pathname.includes("/address-selector")

  const open = () => setShowPrompt(true)
  const close = () => setShowPrompt(false)

  // Re-check on every screen: show the prompt again while permission is not granted.
  useEffect(() => {
    if (isAddressSelector) {
      close()
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const state = await queryBrowserPermission()
      if (cancelled) return
      if (state === "granted") {
        localStorage.setItem("locationPermissionGranted", "true")
        close()
        return
      }
      if (state === "denied") {
        localStorage.setItem("locationPermissionGranted", "denied")
      } else if (isLocationPermissionGranted()) {
        return
      }
      setBlocked(state === "denied")
      open()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pathname, isAddressSelector])

  useEffect(() => {
    const handleOpen = () => {
      if (!isLocationPermissionGranted()) open()
    }
    window.addEventListener(OPEN_LOCATION_PROMPT_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_LOCATION_PROMPT_EVENT, handleOpen)
  }, [])

  // card: opacity 0 / translateY 20 -> visible (300 ms)
  useEffect(() => {
    if (!showPrompt) return
    enter.setValue(0)
    Animated.timing(enter, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [showPrompt, enter])

  const handleAllow = async () => {
    setIsRequesting(true)
    try {
      await requestLocation()
      localStorage.setItem("locationPermissionGranted", "true")
      setBlocked(false)
      close()
    } catch {
      const state = await queryBrowserPermission()
      if (state === "denied") setBlocked(true)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleSelectManually = () => {
    close()
    navigate("/food/user/address-selector", { state: { from: pathname } })
  }

  if (!showPrompt) return null

  const busy = loading || isRequesting

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.6) }]} />
        <Animated.View
          style={[
            s.card,
            { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
          ]}
        >
          <Pressable onPress={close} style={({ pressed }) => [s.close, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityLabel="Close">
            <X size={18} color="#DC2626" strokeWidth={2.5} />
          </Pressable>

          <View style={s.iconWrap}>
            <Ping color={t.dark ? alpha("#450a0a", 0.4) : colors.red[100]} />
            {/* ring-8 ring-red-100/50 */}
            <View style={s.iconRing} />
            <View style={s.iconCircle}>
              <MapPin size={32} color="#DC2626" />
            </View>
          </View>

          <Text style={s.title}>Enable Location Services</Text>
          <Text style={s.text}>
            Allow location access to discover great local restaurants near you, view accurate delivery times, and explore exclusive offers in your area.
          </Text>

          {blocked && (
            <Text style={s.blocked}>Location access is blocked. Turn it on in your phone or browser settings, then tap Allow.</Text>
          )}

          <View style={s.buttons}>
            <Pressable
              onPress={handleAllow}
              disabled={busy}
              style={({ pressed }) => [s.allow, busy && { opacity: 0.85 }, pressed && { backgroundColor: "#B91C1C" }]}
            >
              {busy ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Spin>
                    <View style={s.spinner} />
                  </Spin>
                  <Text style={s.allowText}>Getting Location...</Text>
                </View>
              ) : (
                <Text style={s.allowText}>Allow Location Access</Text>
              )}
            </Pressable>
            <Pressable onPress={handleSelectManually} style={({ pressed }) => [s.manual, pressed && { backgroundColor: alpha(t.dark ? "#a1a1aa" : "#71717a", 0.2) }]}>
              <Text style={s.manualText}>Select Location Manually</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%",
    maxWidth: 384,
    backgroundColor: dark ? colors.zinc[900] : colors.white,
    borderWidth: 1,
    borderColor: dark ? colors.zinc[800] : colors.zinc[100],
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 25 },
  },
  close: {
    position: "absolute",
    right: 16,
    top: 16,
    padding: 6,
    borderRadius: 9999,
    backgroundColor: dark ? alpha("#450a0a", 0.4) : colors.red[50],
    zIndex: 2,
  },
  iconWrap: { marginBottom: 20, marginTop: 16, width: 64, height: 64 },
  iconRing: {
    position: "absolute",
    left: -8,
    top: -8,
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: dark ? alpha("#450a0a", 0.1) : alpha(colors.red[100], 0.5),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: dark ? alpha("#450a0a", 0.3) : colors.red[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "700", letterSpacing: -0.5, textAlign: "center", color: dark ? colors.zinc[50] : colors.zinc[900] },
  text: { fontSize: 14, lineHeight: 22.75, textAlign: "center", marginTop: 12, paddingHorizontal: 4, color: dark ? colors.zinc[400] : colors.zinc[500] },
  blocked: { fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center", marginTop: 12, paddingHorizontal: 4, color: "#DC2626" },
  buttons: { width: "100%", gap: 10, marginTop: 24 },
  allow: { width: "100%", height: 48, borderRadius: 9999, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#dc2626", shadowOpacity: 0.1, shadowRadius: 10 },
  allowText: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.white },
  spinner: { width: 16, height: 16, borderRadius: 9999, borderWidth: 2, borderColor: alpha("#ffffff", 0.25), borderTopColor: colors.white },
  manual: {
    width: "100%",
    height: 48,
    borderRadius: 9999,
    backgroundColor: alpha(dark ? "#a1a1aa" : "#71717a", 0.1),
    borderWidth: 1,
    borderColor: alpha(dark ? "#a1a1aa" : "#71717a", 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  manualText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: dark ? colors.zinc[200] : colors.zinc[700] },
}))
