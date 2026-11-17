// Web: modules/Food/components/user/home/ComboOffersRow.jsx — the Home "Combo Offers" slider (admin-curated combos,
// GET /food/combo-offers/public). Combos from open restaurants come first (admin order kept); offline / closed ones go
// last in black & white with ADD disabled. Veg mode hides non-veg combos. Same exports: useComboOffers (also used by the
// restaurant page's "Combo Offers" filter), ComboAddButton, default ComboOffersRow.
import React, { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Path, Text as SvgText } from "react-native-svg"
import { Minus, Plus, Store } from "lucide-react-native"
import { toast } from "@/lib/toast"
import { AppImage, Skeleton, Text } from "@/native/ui"
import { alpha, colors, makeStyles, shadow, useTheme } from "@/theme"
import { publicGetOnce } from "@food/api"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import { isVegMenuItem } from "@food/utils/vegMode"
import { buildCartLineId, getDefaultFoodVariant } from "@food/utils/foodVariants"
import dishFallbackImage from "@food/assets/placeholders/dish_fallback.webp"

/** Fetches the admin-curated combo offers (optionally for one restaurant). */
export function useComboOffers({ zoneId, enabled = true } = {}) {
  const [comboOffers, setComboOffers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    publicGetOnce("/food/combo-offers/public", zoneId ? { params: { zoneId } } : {})
      .then((res) => {
        if (!cancelled) setComboOffers(res?.data?.data?.comboOffers || [])
      })
      .catch(() => {
        if (!cancelled) setComboOffers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [zoneId, enabled])

  return { comboOffers, loading }
}

/** Restaurant switched itself offline / deactivated, as opposed to just being outside its hours. */
const isManuallyOffline = (availability) => availability?.reason === "inactive" || availability?.reason === "not-accepting-orders"

const availabilityRank = (availability) => (availability?.isOpen ? 0 : isManuallyOffline(availability) ? 2 : 1)

/** Builds the cart line the same way the restaurant menu does, so quantities stay in sync. */
const toCartItem = (item, restaurant) => {
  const variant = getDefaultFoodVariant(item)
  const lineItemId = buildCartLineId(item.id || item._id, variant?.id || "")
  return {
    id: lineItemId,
    lineItemId,
    itemId: item.id || item._id,
    name: item.name,
    price: variant?.price ?? item.price,
    basePrice: variant?.basePrice ?? item.basePrice ?? variant?.price ?? item.price,
    markupAmount: variant?.markupAmount ?? item.markupAmount ?? 0,
    variantId: variant?.id || "",
    variantName: variant?.name || "",
    variantPrice: variant?.price ?? item.price,
    image: item.image,
    restaurant: restaurant.name,
    restaurantId: restaurant._id,
    restaurantZoneId: restaurant.zoneId ? String(restaurant.zoneId) : "",
    description: item.description,
    isVeg: isVegMenuItem(item),
    foodType: item.foodType,
    preparationTime: item.preparationTime,
    pricingScope: variant?.pricingScope ?? item.pricingScope ?? null,
    appliedPricingType: variant?.appliedPricingType ?? item.appliedPricingType ?? null,
    appliedPricingValue: variant?.appliedPricingValue ?? item.appliedPricingValue ?? null,
  }
}

/** ADD button / quantity stepper that writes straight to the cart. */
export function ComboAddButton({ item, restaurant, isOutOfService = false, disabled = false, style }) {
  const { addToCart, updateQuantity, getCartItem } = useCart()
  const s = useStyles()
  const cartItem = toCartItem(item, restaurant)
  const quantity = getCartItem(cartItem.id)?.quantity || 0

  // web: the button's centre on screen (flyToCart start)
  const sourceFromEvent = (event) => {
    const x = event?.nativeEvent?.pageX
    const y = event?.nativeEvent?.pageY
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { viewportX: x, viewportY: y, scrollX: 0, scrollY: 0, itemId: cartItem.id }
  }

  const canOrder = () => {
    if (!isModuleAuthenticated("user")) {
      window.dispatchEvent(new CustomEvent("show-login-required"))
      return false
    }
    if (isOutOfService) {
      toast.error("You are outside the service zone. Please select a location within the service area.")
      return false
    }
    const availability = getRestaurantAvailabilityStatus(restaurant)
    if (!availability.isOpen) {
      if (!isManuallyOffline(availability) && availability.openingTime) {
        toast.error(`${restaurant.name} is closed right now. Opens at ${availability.openingTime}.`)
      } else {
        toast.error(`${restaurant.name} is currently offline. Please try again later.`)
      }
      return false
    }
    return true
  }

  const handleAdd = (event) => {
    if (!canOrder()) return
    const source = sourceFromEvent(event)
    if (quantity > 0) {
      updateQuantity(cartItem.id, quantity + 1, source, { id: cartItem.id, name: item.name, imageUrl: item.image })
      return
    }
    Promise.resolve(addToCart(cartItem, source)).then((result) => {
      if (result?.ok === false && result.code !== "ORDER_TYPE_MISMATCH") {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.")
      }
    })
  }

  const handleRemove = (event) => {
    updateQuantity(cartItem.id, quantity - 1, sourceFromEvent(event), { id: cartItem.id, name: item.name, imageUrl: item.image })
  }

  if (disabled) {
    return (
      <View style={[s.addBase, s.addDisabled, style]}>
        <Text style={s.addDisabledText}>ADD</Text>
        <Plus size={14} color={colors.gray[400]} />
      </View>
    )
  }

  if (quantity > 0) {
    return (
      <View style={[s.stepper, style]}>
        <Pressable onPress={handleRemove} style={s.stepBtn} accessibilityLabel="Remove one">
          <Minus size={14} color={colors.white} />
        </Pressable>
        <Text style={s.stepQty}>{quantity}</Text>
        <Pressable onPress={handleAdd} style={s.stepBtn} accessibilityLabel="Add one">
          <Plus size={14} color={colors.white} />
        </Pressable>
      </View>
    )
  }

  return (
    <Pressable onPress={handleAdd} style={({ pressed }) => [s.addBase, s.addOn, pressed && s.addPressed, style]}>
      <Text style={s.addOnText}>ADD</Text>
      <Plus size={14} color="#DC2626" />
    </Pressable>
  )
}

// Same scallop "%" offer badge as the restaurant cards, inverted (white badge, blue %) for a blue chip.
const OfferScallop = ({ size = 14 }) => (
  <Svg viewBox="0 0 100 100" width={size} height={size}>
    <Path
      fill="#ffffff"
      d="M 86.29 42.78 Q 95.00 50.00 86.29 57.22 Q 91.57 67.22 80.76 70.56 Q 81.82 81.82 70.56 80.76 Q 67.22 91.57 57.22 86.29 Q 50.00 95.00 42.78 86.29 Q 32.78 91.57 29.44 80.76 Q 18.18 81.82 19.24 70.56 Q 8.43 67.22 13.71 57.22 Q 5.00 50.00 13.71 42.78 Q 8.43 32.78 19.24 29.44 Q 18.18 18.18 29.44 19.24 Q 32.78 8.43 42.78 13.71 Q 50.00 5.00 57.22 13.71 Q 67.22 8.43 70.56 19.24 Q 81.82 18.18 80.76 29.44 Q 91.57 32.78 86.29 42.78 Z"
    />
    <SvgText x="50" y="63" textAnchor="middle" fontSize="42" fontWeight="900" fill="#2563EB">
      %
    </SvgText>
  </Svg>
)

const VegMark = ({ isVeg }) => (
  <View
    accessibilityLabel={isVeg ? "Veg" : "Non-veg"}
    style={{
      height: 14,
      width: 14,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: isVeg ? colors.green[600] : colors.red[600],
      backgroundColor: colors.white,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <View style={{ height: 6, width: 6, borderRadius: 9999, backgroundColor: isVeg ? colors.green[600] : colors.red[600] }} />
  </View>
)

export default function ComboOffersRow({ zoneId, zoneLoading = false, isOutOfService = false, vegMode = false }) {
  const { comboOffers, loading } = useComboOffers({ zoneId, enabled: !zoneLoading })
  const s = useStyles()
  const t = useTheme()

  // Re-check open/closed every minute so cards flip without a reload.
  const [availabilityTick, setAvailabilityTick] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAvailabilityTick(Date.now()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const visibleCombos = useMemo(() => {
    const now = new Date(availabilityTick)
    return comboOffers
      .filter(({ item }) => !vegMode || isVegMenuItem(item))
      .map((combo, order) => ({ ...combo, order, availability: getRestaurantAvailabilityStatus(combo.restaurant, now) }))
      .sort((a, b) => availabilityRank(a.availability) - availabilityRank(b.availability) || a.order - b.order)
  }, [comboOffers, vegMode, availabilityTick])

  if (!loading && visibleCombos.length === 0) return null

  const skeletonColor = t.dark ? colors.gray[800] : colors.gray[200]

  return (
    <View style={{ paddingTop: 16 }}>
      <Text style={s.heading}>Combo Offers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 16, paddingHorizontal: 16 }}>
        {loading && visibleCombos.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <View key={`combo-skeleton-${i}`} style={s.card}>
                <Skeleton style={{ height: 190, borderRadius: 0, backgroundColor: skeletonColor }} />
                <View style={{ padding: 12 }}>
                  <Skeleton style={{ height: 16, width: "83%", borderRadius: 4, backgroundColor: skeletonColor }} />
                  <Skeleton style={{ height: 12, width: "66%", borderRadius: 4, marginTop: 8 }} />
                  <Skeleton style={{ height: 16, width: 64, borderRadius: 4, marginTop: 12, backgroundColor: skeletonColor }} />
                  <View style={[s.footer, { marginTop: 10 }]}>
                    <Skeleton style={{ height: 12, width: 96, borderRadius: 4 }} />
                    <Skeleton style={{ height: 32, width: 84, borderRadius: 8, backgroundColor: skeletonColor }} />
                  </View>
                </View>
              </View>
            ))
          : null}
        {visibleCombos.map(({ _id, item, restaurant, availability }) => {
          const isOffline = isManuallyOffline(availability)
          const unavailable = isOutOfService || !availability.isOpen
          return (
            <View key={_id} style={[s.card, unavailable && s.grayscale]}>
              {/* Offer posters put their headline at the top: fill the card but anchor the crop to the top edge. */}
              <View style={s.imageBox}>
                <AppImage
                  src={item.image || dishFallbackImage}
                  fallback={dishFallbackImage}
                  contentFit="cover"
                  contentPosition="top"
                  style={StyleSheet.absoluteFill}
                  accessibilityLabel={item.name}
                />
              </View>
              <View style={s.body}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                  <View style={{ marginTop: 4 }}>
                    <VegMark isVeg={isVegMenuItem(item)} />
                  </View>
                  <Text numberOfLines={2} style={s.name}>{item.name}</Text>
                </View>
                <View style={s.priceRow}>
                  <Text style={s.price}>₹{Math.round(Number(item.price) || 0)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 1 }}>
                    {!availability.isOpen && (
                      <Text numberOfLines={1} style={[s.closedText, isOffline && { color: t.dark ? colors.red[400] : colors.red[600] }]}>
                        {isOffline ? "Offline" : availability.openingTime ? `Opens at ${availability.openingTime}` : "Closed"}
                      </Text>
                    )}
                    {/* Combo Offers badge (two lines): blue like the restaurant-card offers, glossy top edge. */}
                    <LinearGradient colors={["#3b82f6", "#1d4ed8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
                      <View pointerEvents="none" style={s.badgeGloss} />
                      <OfferScallop size={14} />
                      <View>
                        <Text style={s.badgeText}>COMBO</Text>
                        <Text style={s.badgeText}>OFFERS</Text>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
                <View style={[s.footer, { marginTop: "auto" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <Store size={14} color={t.dark ? colors.gray[300] : colors.gray[600]} />
                    <Text numberOfLines={1} style={s.restaurantName}>{restaurant.name}</Text>
                  </View>
                  <ComboAddButton item={item} restaurant={restaurant} isOutOfService={isOutOfService} disabled={unavailable} style={{ width: 84, flexShrink: 0 }} />
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  heading: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: dark ? colors.gray[500] : colors.gray[400], letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, paddingHorizontal: 16 },
  card: {
    width: 270,
    flexDirection: "column",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: dark ? colors.gray[800] : alpha(colors.gray[200], 0.7),
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    ...shadow.md,
  },
  grayscale: { filter: [{ grayscale: 1 }], opacity: 0.75 },
  imageBox: { height: 190, overflow: "hidden", backgroundColor: dark ? colors.gray[800] : colors.gray[100] },
  body: { flex: 1, flexDirection: "column", padding: 12 },
  name: { flex: 1, minHeight: 2.75 * 14 * 1.375, fontSize: 14, lineHeight: 19.25, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  priceRow: { marginTop: 6, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  closedText: { flexShrink: 1, fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: dark ? colors.gray[400] : colors.gray[600] },
  badge: { flexDirection: "row", alignItems: "center", gap: 2, overflow: "hidden", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: alpha("#ffffff", 0.2), ...shadow.sm },
  badgeGloss: { position: "absolute", left: 0, right: 0, top: 0, height: 1, backgroundColor: alpha("#ffffff", 0.4) },
  badgeText: { fontSize: 8, lineHeight: 8.8, fontWeight: "500", letterSpacing: 0.64, color: colors.white },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: dark ? colors.gray[800] : colors.gray[100] },
  restaurantName: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: "600", color: dark ? colors.gray[300] : colors.gray[600] },
  addBase: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  addDisabled: { borderColor: dark ? colors.gray[700] : colors.gray[300], backgroundColor: dark ? colors.gray[800] : colors.gray[100] },
  addDisabledText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: colors.gray[400] },
  addOn: { borderColor: "#DC2626", backgroundColor: dark ? "#1a1a1a" : colors.white, ...shadow.sm },
  addPressed: { backgroundColor: dark ? alpha(colors.red[900], 0.2) : colors.red[50] },
  addOnText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#DC2626" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 8, backgroundColor: "#DC2626", ...shadow.sm },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  stepQty: { minWidth: 20, textAlign: "center", fontSize: 14, lineHeight: 20, fontWeight: "700", color: colors.white },
}))
