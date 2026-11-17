// Web: modules/Food/components/user/AddToCartAnimation.jsx — the red "View cart" pill (RestaurantDetails, Under 250):
// the last three dish photos stacked, "View cart" / "Takeaway Cart" + item count and an arrow. A dish added with ADD / +
// flies from the button into the pill (flyToCart; removals just update the count). Hidden on cart / order / account
// pages. `dynamicBottom` is the web's Tailwind class ("bottom-[92px]") or a number; `active` = the page is on screen
// (the web checked that its anchor element was laid out).
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Path } from "react-native-svg"
import { useLocation, useNavigate } from "@/lib/router"
import { AppImage, Text } from "@/native/ui"
import { alpha, colors } from "@/theme"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { flyToCart, sourceToViewportPoint, isShownOnScreen, FLY_ARRIVE_MS } from "@food/utils/flyToCart"
import dishFallbackImage from "@food/assets/placeholders/dish_fallback.webp"

/** Cart line ids are "<itemId>::<variantId>"; thumbnails are matched on the dish id alone. */
const thumbBaseId = (id) => String(id || "").split("::")[0]

const parseBottom = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const m = String(value || "").match(/bottom-\[(\d+(?:\.\d+)?)px\]/)
  if (m) return Number(m[1])
  const n = String(value || "").match(/bottom-(\d+(?:\.\d+)?)/)
  return n ? Number(n[1]) * 4 : null
}

function Thumb({ item, idx, hidden }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: hidden ? 0 : 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [hidden, v])
  const imgSrc = item?.image || item?.product?.imageUrl || item?.imageUrl || dishFallbackImage
  return (
    <Animated.View
      style={[
        styles.thumb,
        idx > 0 && { marginLeft: -16 },
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [hidden ? 0.6 : 0, 1] }) }] },
      ]}
    >
      <AppImage src={imgSrc} fallback={dishFallbackImage} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  )
}

export default function AddToCartAnimation({
  bottomOffset = 96,
  pillStyle,
  hideOnPages = true,
  linkTo = "/food/user/cart",
  dynamicBottom = null,
  active = true,
}) {
  const { items, itemCount, lastAddEvent } = useCart()
  const { orderType } = useProfile()
  const isTakeaway = orderType === "takeaway"
  const cartLinkTo = isTakeaway ? "/food/user/cart" : linkTo || "/food/user/cart"
  const location = useLocation()
  const navigate = useNavigate()
  const { width: winW, height: winH } = useWindowDimensions()
  const linkRef = useRef(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [flyingProduct, setFlyingProduct] = useState(null)

  const p = location.pathname
  const iscartPage = p === "/cart" || p === "/user/cart" || p.startsWith("/cart/") || p.startsWith("/user/cart/")
  const isOrderPage = p.startsWith("/orders/")
  const isAccountPage = p === "/account"
  const shouldHidePill = hideOnPages && (iscartPage || isOrderPage || isAccountPage)

  const safeItems = Array.isArray(items) ? items : []
  const thumbnailItems = safeItems
    .slice(-3)
    .reverse()
    .filter((item) => item && typeof item === "object")
  const shownThumbIdsRef = useRef(new Set())
  const bottom = dynamicBottom ? parseBottom(dynamicBottom) ?? 20 : bottomOffset || 20

  useEffect(() => {
    const from = sourceToViewportPoint(lastAddEvent?.sourcePosition)
    if (!from) return undefined
    if (!isShownOnScreen(activeRef.current)) return undefined
    const key = `${Date.now()}-${Math.random()}`
    const productId = String(lastAddEvent.product?.id || "")
    if (!shownThumbIdsRef.current.has(thumbBaseId(productId))) {
      setFlyingProduct({ key, product: { ...lastAddEvent.product } })
    }
    let timer = null
    const raf = requestAnimationFrame(() => {
      const launch = (to) => {
        flyToCart({ image: lastAddEvent.product?.imageUrl, from, to })
        timer = setTimeout(() => {
          setFlyingProduct((current) => (current?.key === key ? null : current))
        }, FLY_ARRIVE_MS)
      }
      const node = linkRef.current
      if (node?.measureInWindow) {
        node.measureInWindow((x, y, w, h) => {
          launch(w || h ? { x: x + 22, y: y + h / 2 } : { x: winW / 2, y: winH - bottom - 24 })
        })
      } else {
        launch({ x: winW / 2, y: winH - bottom - 24 })
      }
    })
    return () => {
      cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddEvent])

  useEffect(() => {
    shownThumbIdsRef.current = new Set(thumbnailItems.map((item) => thumbBaseId(item?.itemId || item?.id)))
  })

  const shown = itemCount > 0 && !shouldHidePill
  // initial opacity 0 / scale 0.8 -> 1 (spring 400 / 30 / 0.8); text slides in from the left, arrow from the right
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!shown) return
    enter.setValue(0)
    Animated.spring(enter, { toValue: 1, stiffness: 400, damping: 30, mass: 0.8, useNativeDriver: true }).start()
  }, [shown, enter])

  if (!shown) return null

  const flyingId = flyingProduct ? String(flyingProduct.product?.id || "") : ""

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
      ]}
    >
      <Pressable
        ref={linkRef}
        collapsable={false}
        onPress={() => navigate(cartLinkTo, { state: { from: location.pathname } })}
        style={[styles.pill, pillStyle]}
      >
        <LinearGradient colors={["#991b1b", "#DC2626", "#991b1b"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: 9999 }]} />
        <View style={styles.thumbs}>
          {thumbnailItems.map((item, idx) => {
            const isFlying = Boolean(flyingId) && (String(item?.id) === flyingId || String(item?.itemId || "") === thumbBaseId(flyingId))
            return (
              <Thumb
                key={item?.itemId ? `${item.itemId}::${item.variantId || ""}` : item?.id || `thumb-${idx}`}
                item={item}
                idx={idx}
                hidden={isFlying}
              />
            )
          })}
        </View>
        <Animated.View style={{ opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
          <Text style={styles.title}>{isTakeaway ? "Takeaway Cart" : "View cart"}</Text>
          <Text style={styles.count}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Text>
        </Animated.View>
        <Animated.View
          style={[styles.arrow, { opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        >
          <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <Path d="M6 12L10 8L6 4" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 9990, elevation: 40, alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: alpha("#DC2626", 0.3),
    elevation: 10,
    shadowColor: "#DC2626",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  thumbs: { flexDirection: "row", alignItems: "center" },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: alpha("#ffffff", 0.9),
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  title: { fontSize: 12, lineHeight: 15, fontWeight: "700", color: colors.white },
  count: { fontSize: 10, lineHeight: 12.5, fontWeight: "500", color: alpha("#ffffff", 0.95) },
  arrow: { marginLeft: "auto", backgroundColor: alpha("#ffffff", 0.25), borderRadius: 9999, padding: 4 },
})
