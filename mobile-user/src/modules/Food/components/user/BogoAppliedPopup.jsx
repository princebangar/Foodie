// Web: modules/Food/components/user/BogoAppliedPopup.jsx — watches the cart for Buy 1 Get 1 lines:
// - free unit first unlocked -> "offer applied" popup with confetti, once per line until it's removed;
// - quantity raised past the admin-set per-order free limit -> toast that extra units are charged;
// - offer already used up by this user (admin "uses per user") -> toast, no popup.
// For a logged-in user a just-added line waits for the server's reply (which knows their usage) before it can
// celebrate. The cart as loaded from the server is the baseline, so reopening the app never pops anything.
// Mounted once by UserLayout. canvas-confetti -> <Confetti>; the fixed overlay -> a native Modal.
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { BadgePercent } from "lucide-react-native"
import { toast } from "@/lib/toast"
import { Confetti, Text } from "@/native/ui"
import { alpha, colors, makeStyles, shadow, useTheme } from "@/theme"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { getBogoLimit, getCartBogoFreeByLine, getCartDishQuantity, isBogoUsedUp } from "@food/utils/bogo"

const lineKey = (item) => `${item?.itemId || item?.productId || item?.id || ""}::${item?.variantId || ""}`
const dishKey = (item) => String(item?.itemId || item?.productId || item?.id || "")

const AUTO_CLOSE_MS = 3500

function BogoToastCard({ title, message }) {
  const t = useTheme()
  return (
    <View style={[toastStyles.card, t.dark && { backgroundColor: "#1a1a1a", borderColor: colors.gray[800] }]}>
      <LinearGradient colors={["#4f8bff", "#1d4ed8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={toastStyles.icon}>
        <BadgePercent size={26} color={colors.white} />
      </LinearGradient>
      <View style={{ flex: 1, paddingRight: 4, minWidth: 0 }}>
        <Text style={[toastStyles.title, t.dark && { color: colors.white }]}>{title}</Text>
        <Text numberOfLines={2} style={[toastStyles.message, t.dark && { color: colors.gray[400] }]}>{message}</Text>
      </View>
    </View>
  )
}

/** Buy 1 Get 1 notice in the app's branded toast card (same shape as the other user toasts). */
const showBogoToast = (id, title, message) =>
  toast.custom(() => <BogoToastCard title={title} message={message} />, { id, duration: 4000, position: "top-center" })

export default function BogoAppliedPopup() {
  const { cart, cartReady } = useCart()
  const [applied, setApplied] = useState(null)
  const [confettiTick, setConfettiTick] = useState(0)
  const prevQtyRef = useRef(null)
  const prevFreeRef = useRef(new Map())
  const prevDishQtyRef = useRef(new Map())
  const celebratedRef = useRef(new Set())
  const usedUpWarnedRef = useRef(new Set())
  const limitWarnedRef = useRef(new Set())
  const s = useStyles()
  const pop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!cartReady) return
    const lines = Array.isArray(cart) ? cart : []
    const loggedIn = isModuleAuthenticated("user")
    const confirmed = (item) => !loggedIn || item?.bogoServerChecked === true
    const allFree = getCartBogoFreeByLine(lines)
    const freeByKey = new Map(lines.map((item) => [lineKey(item), confirmed(item) ? allFree.get(item.id) || 0 : 0]))
    const next = new Map(lines.map((item) => [lineKey(item), Number(item?.quantity) || 0]))
    const prev = prevQtyRef.current
    const prevFree = prevFreeRef.current
    const prevDishQty = prevDishQtyRef.current
    prevQtyRef.current = next
    prevFreeRef.current = freeByKey
    prevDishQtyRef.current = new Map(
      lines.filter((item) => item?.isBogo === true).map((item) => [dishKey(item), getCartDishQuantity(lines, item)]),
    )

    if (!prev) {
      lines.forEach((item) => {
        if (allFree.get(item.id) > 0) celebratedRef.current.add(lineKey(item))
        if (isBogoUsedUp(item)) usedUpWarnedRef.current.add(lineKey(item))
        if (item?.isBogo === true && getCartDishQuantity(lines, item) > getBogoLimit(item)) limitWarnedRef.current.add(dishKey(item))
      })
      return
    }

    ;[celebratedRef.current, usedUpWarnedRef.current].forEach((set) =>
      set.forEach((key) => {
        if (!next.has(key)) set.delete(key)
      }),
    )

    for (const item of lines) {
      const key = lineKey(item)
      if (!isBogoUsedUp(item) || usedUpWarnedRef.current.has(key)) continue
      usedUpWarnedRef.current.add(key)
      showBogoToast(
        `bogo-used-toast-${dishKey(item)}`,
        `You've already used Buy 1 Get 1 on ${item.name || "this item"}`,
        "This offer has a usage limit per customer, so this item is charged at full price.",
      )
    }

    const overLimit = new Set(
      lines.filter((item) => item?.isBogo === true && getCartDishQuantity(lines, item) > getBogoLimit(item)).map(dishKey),
    )
    limitWarnedRef.current.forEach((key) => {
      if (!overLimit.has(key)) limitWarnedRef.current.delete(key)
    })
    for (const item of lines) {
      if (item?.isBogo !== true || isBogoUsedUp(item) || limitWarnedRef.current.has(dishKey(item))) continue
      const limit = getBogoLimit(item)
      const dishQty = getCartDishQuantity(lines, item)
      if (dishQty > limit && dishQty > (prevDishQty.get(dishKey(item)) || 0)) {
        limitWarnedRef.current.add(dishKey(item))
        showBogoToast(
          `bogo-limit-toast-${dishKey(item)}`,
          `Buy 1 Get 1: only ${limit} free ${limit === 1 ? "item" : "items"} per order`,
          `You get ${limit} free on ${limit} ${item.name || "item"}. Extra quantity is charged.`,
        )
      }
    }

    for (const item of lines) {
      const key = lineKey(item)
      if (!(freeByKey.get(key) > 0) || (prevFree.get(key) || 0) > 0 || celebratedRef.current.has(key)) continue
      celebratedRef.current.add(key)
      setApplied({ name: item.name || "Item", saved: Math.round(Number(item.price) || 0) })
      return
    }
  }, [cart, cartReady])

  useEffect(() => {
    if (!applied) return undefined
    setConfettiTick((n) => n + 1)
    // bogoPopIn: opacity 0 / scale 0.8 -> 1, 0.35 s cubic-bezier(0.34, 1.56, 0.64, 1)
    pop.setValue(0)
    Animated.timing(pop, { toValue: 1, duration: 350, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start()
    const timer = setTimeout(() => setApplied(null), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [applied, pop])

  if (!applied) return null

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => setApplied(null)}>
      <Pressable style={s.backdrop} onPress={() => setApplied(null)} accessibilityLabel="Buy 1 Get 1 offer applied">
        <Animated.View
          style={[s.card, { opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
        >
          <Pressable onPress={() => {}} style={{ alignItems: "center" }}>
            <View style={s.badge}>
              <BadgePercent size={38} color={colors.white} />
            </View>
            <Text style={s.kicker}>'BUY 1 GET 1' applied</Text>
            <Text style={s.amount}>₹{applied.saved}</Text>
            <Text style={s.saved}>saved with this offer</Text>
            <Text numberOfLines={2} style={s.note}>{`1 more ${applied.name} added free to your order`}</Text>
            <Pressable onPress={() => setApplied(null)} style={({ pressed }) => [s.button, pressed && { backgroundColor: alpha("#256fef", 0.1) }]}>
              <Text style={s.buttonText}>Woohoo! Thanks</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
        <Confetti fire={confettiTick} particleCount={90} spread={75} origin={{ x: 0.5, y: 0.55 }} />
      </Pressable>
    </Modal>
  )
}

const toastStyles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray[50],
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
  },
  icon: { height: 48, width: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, lineHeight: 16, fontWeight: "700", color: colors.gray[900] },
  message: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: colors.gray[500], marginTop: 2 },
})

const useStyles = makeStyles(({ dark }) => ({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: alpha("#000000", 0.4), paddingHorizontal: 24 },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 48,
    ...shadow["2xl"],
  },
  badge: {
    position: "absolute",
    top: -36 - 48,
    height: 72,
    width: 72,
    borderRadius: 9999,
    backgroundColor: "#256fef",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: dark ? "#1a1a1a" : colors.white,
    ...shadow.lg,
  },
  kicker: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: dark ? colors.gray[400] : colors.gray[500], textAlign: "center" },
  amount: { marginTop: 8, fontSize: 30, lineHeight: 36, fontWeight: "800", color: dark ? colors.white : colors.gray[900], textAlign: "center" },
  saved: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: dark ? colors.gray[300] : colors.gray[700], textAlign: "center" },
  note: { marginTop: 8, fontSize: 12, lineHeight: 16, color: dark ? colors.gray[400] : colors.gray[500], textAlign: "center" },
  button: { marginTop: 20, width: "100%", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#256fef" },
}))
