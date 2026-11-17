// Web: modules/Food/components/user/StickyCartCard.jsx — the red cart pill above the bottom nav on Home: the last three
// dish photos stacked, the restaurant name + "View Menu", "View cart · N items" and a close X. It drops into the space
// the bottom nav frees while that is hidden (112 px -> 32 px from the bottom), comes back after X on any new item, and
// a dish added with ADD / + flies into the stack (flyToCart) — only while this page is the one on screen (`active`:
// Home passes isTabActive; the web checked that its anchor element was laid out).
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { X, ChevronRight } from "lucide-react-native"
import { Link } from "@/lib/router"
import { AppImage, Text } from "@/native/ui"
import { alpha, colors } from "@/theme"
import { useCart } from "@food/context/CartContext"
import dishFallbackImage from "@food/assets/placeholders/dish_fallback.webp"
import { isBottomNavVisible, subscribeBottomNavVisibility } from "@food/utils/bottomNavEvents"
import { flyToCart, sourceToViewportPoint, isShownOnScreen, FLY_ARRIVE_MS } from "@food/utils/flyToCart"

const CARD_BOTTOM_WITH_NAV_PX = 112
const CARD_BOTTOM_WITHOUT_NAV_PX = 32

const lineBaseId = (id) => String(id || "").split("::")[0]

function Thumb({ item, idx, count, hidden }) {
  // initial scale 0 / opacity 0 -> 1 (tween 0.15 s easeOut); 0.6 / 0 while its own photo is still flying in
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: hidden ? 0 : 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [hidden, v])
  return (
    <Animated.View
      style={[
        styles.thumb,
        idx > 0 && { marginLeft: -16 },
        {
          zIndex: count - idx,
          elevation: count - idx,
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [hidden ? 0.6 : 0, 1] }) }],
        },
      ]}
    >
      <AppImage src={item.image || item.imageUrl || dishFallbackImage} fallback={dishFallbackImage} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  )
}

export default function StickyCartCard({ active = true }) {
  const { cart, getCartCount, lastAddEvent } = useCart()
  const { width: winW, height: winH } = useWindowDimensions()
  const [isVisible, setIsVisible] = useState(true)
  const [navVisible, setNavVisible] = useState(isBottomNavVisible)
  const [flying, setFlying] = useState(null)
  const thumbsRef = useRef(null)
  const cartCount = getCartCount()
  const prevCountRef = useRef(cartCount)
  const shownThumbIdsRef = useRef(new Set())
  const activeRef = useRef(active)
  activeRef.current = active
  const thumbnailItems = (Array.isArray(cart) ? cart : []).slice(-3).reverse().filter((item) => item && typeof item === "object")

  // Closed with X? Any new item (ADD or +) brings the card back.
  useEffect(() => {
    if (cartCount > prevCountRef.current) setIsVisible(true)
    prevCountRef.current = cartCount
  }, [cartCount])

  useEffect(() => {
    setNavVisible(isBottomNavVisible())
    return subscribeBottomNavVisibility(setNavVisible)
  }, [])

  // ADD / + tapped somewhere on the page: fly the dish photo from the button into the card.
  useEffect(() => {
    const from = sourceToViewportPoint(lastAddEvent?.sourcePosition)
    if (!from) return undefined
    if (!isShownOnScreen(activeRef.current)) return undefined
    const key = `${Date.now()}-${Math.random()}`
    setIsVisible(true)
    const productId = String(lastAddEvent.product?.id || "")
    if (!shownThumbIdsRef.current.has(lineBaseId(productId))) {
      setFlying({ key, id: productId })
    }
    let timer = null
    // one frame so a card that just mounted (first item) is laid out before we aim at it
    const raf = requestAnimationFrame(() => {
      const launch = (to) => {
        flyToCart({ image: lastAddEvent.product?.imageUrl, from, to })
        timer = setTimeout(() => {
          setFlying((current) => (current?.key === key ? null : current))
        }, FLY_ARRIVE_MS)
      }
      const node = thumbsRef.current
      if (node?.measureInWindow) {
        node.measureInWindow((x, y, w, h) => {
          launch(w || h ? { x: x + 20, y: y + h / 2 } : { x: winW / 2, y: winH - CARD_BOTTOM_WITH_NAV_PX })
        })
      } else {
        launch({ x: winW / 2, y: winH - CARD_BOTTOM_WITH_NAV_PX })
      }
    })
    return () => {
      cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddEvent])

  useEffect(() => {
    shownThumbIdsRef.current = new Set(thumbnailItems.map((item) => lineBaseId(item.itemId || item.id)))
  })

  // bottom: tween 0.25 s ease [0.22, 1, 0.36, 1]; enter: opacity 0 -> 1, scale 0.9 -> 1 (spring 300 / 25)
  const bottomPx = !navVisible ? CARD_BOTTOM_WITHOUT_NAV_PX : CARD_BOTTOM_WITH_NAV_PX
  const bottom = useRef(new Animated.Value(bottomPx)).current
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(bottom, { toValue: bottomPx, duration: 250, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start()
  }, [bottomPx, bottom])
  const shown = cartCount > 0 && isVisible
  useEffect(() => {
    if (shown) {
      enter.setValue(0)
      Animated.spring(enter, { toValue: 1, stiffness: 300, damping: 25, mass: 0.8, useNativeDriver: false }).start()
    }
  }, [shown, enter])

  const closeScale = useRef(new Animated.Value(1)).current
  const springClose = (to) => Animated.spring(closeScale, { toValue: to, stiffness: 400, damping: 17, useNativeDriver: false }).start()

  if (!shown) return null

  const restaurantName = cart[0]?.restaurant || "Restaurant"
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-")
  const isFlyingItem = (item) =>
    Boolean(flying) && (String(item.id) === flying.id || String(item.itemId || "") === lineBaseId(flying.id))

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
      ]}
    >
      <View style={styles.card}>
        <LinearGradient colors={["#991b1b", "#DC2626", "#991b1b"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        {/* Soft top sheen */}
        <LinearGradient pointerEvents="none" colors={[alpha("#ffffff", 0.15), "transparent"]} style={styles.sheen} />

        <View style={styles.row}>
          {/* Stacked dish photos */}
          <View ref={thumbsRef} collapsable={false} style={styles.thumbs}>
            {thumbnailItems.map((item, idx) => (
              <Thumb
                key={item.itemId ? `${item.itemId}::${item.variantId || ""}` : item.id || `thumb-${idx}`}
                item={item}
                idx={idx}
                count={thumbnailItems.length}
                hidden={isFlyingItem(item)}
              />
            ))}
          </View>

          {/* Restaurant Info */}
          <Link to={`/food/user/restaurants/${restaurantSlug}`} style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.name}>{restaurantName}</Text>
            <View style={styles.menuRow}>
              <Text style={styles.menuText}>View Menu</Text>
              <ChevronRight size={12} color={alpha("#ffffff", 0.85)} />
            </View>
          </Link>

          {/* View Cart Button */}
          <Link to="/food/user/cart" style={({ pressed }) => [styles.viewCart, pressed && { transform: [{ scale: 0.95 }] }]}>
            <View>
              <Text style={styles.viewCartTitle}>View cart</Text>
              <Text style={styles.viewCartCount}>
                {cartCount} {cartCount === 1 ? "item" : "items"}
              </Text>
            </View>
            <ChevronRight size={14} color={colors.white} />
          </Link>

          {/* Close Button */}
          <Animated.View style={{ transform: [{ scale: closeScale }] }}>
            <Pressable
              onPress={() => setIsVisible(false)}
              onPressIn={() => springClose(0.85)}
              onPressOut={() => springClose(1)}
              accessibilityLabel="Hide cart"
              style={styles.close}
            >
              <X size={14} color={colors.white} strokeWidth={2.75} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 50, elevation: 50, paddingHorizontal: 16, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: alpha("#ffffff", 0.15),
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  sheen: { position: "absolute", left: 0, right: 0, top: 0, height: "50%" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 8 },
  thumbs: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  thumb: {
    height: 36,
    width: 36,
    overflow: "hidden",
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: alpha("#ffffff", 0.9),
    backgroundColor: colors.white,
  },
  name: { fontSize: 14, lineHeight: 17.5, fontWeight: "700", color: colors.white },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  menuText: { fontSize: 11, lineHeight: 16, fontWeight: "500", color: alpha("#ffffff", 0.85) },
  viewCart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    borderRadius: 9999,
    backgroundColor: alpha("#ffffff", 0.25),
    borderWidth: 1,
    borderColor: alpha("#ffffff", 0.3),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewCartTitle: { fontSize: 12, lineHeight: 15, fontWeight: "700", color: colors.white },
  viewCartCount: { fontSize: 10, lineHeight: 12.5, fontWeight: "500", color: alpha("#ffffff", 0.95) },
  close: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    backgroundColor: alpha("#000000", 0.2),
    borderWidth: 1,
    borderColor: alpha("#ffffff", 0.3),
  },
})
