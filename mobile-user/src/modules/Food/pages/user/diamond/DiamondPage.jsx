// Web: modules/Food/pages/user/diamond/DiamondPage.jsx — Foodie Diamond membership page (/food/user/diamond):
// wordmark + plan price (or "Member till ..."), savings till now (members), benefits, terms / support links and the
// fixed "Join / Renew Diamond" bar (Razorpay order -> verify). Sections fade up one after another; the top bar title
// fades in after scrolling past the logo. Cached copy draws at once, a fresh one replaces it.
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowLeft, BadgePercent, Bike, ChevronRight, Info, Loader2, MessageSquareText, ReceiptText, Sparkles, Star } from "lucide-react-native"
import { useNavigate } from "@/lib/router"
import { toast } from "@/lib/toast"
import { Text } from "@/native/ui"
import { StatusBar } from "@/native/ui/SectionStatusBar"
import { Spin } from "@/shared/components/Loader"
import { alpha, colors } from "@/theme"
import { userAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { getCompanyNameAsync } from "@food/utils/businessSettings"
import {
  DIAMOND_BG,
  DIAMOND_BUTTON,
  DIAMOND_CARD,
  DIAMOND_FONT,
  DIAMOND_ICE,
  DiamondPattern,
  DiamondWordmark,
  formatINR,
  formatMemberDate,
} from "@food/components/user/diamond/DiamondBrand"
import { fetchDiamond, getCachedDiamond, setCachedDiamond } from "@food/components/user/diamond/diamondCache"

const BENEFIT_ICONS = {
  free_delivery: Bike,
  extra_discount: BadgePercent,
  free_platform_fee: ReceiptText,
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const font = { fontFamily: DIAMOND_FONT }

/** Sections fade up one after another (opacity 0 / y 14 -> visible, 0.45 s, delay 0.08 + step * 0.13). */
function Reveal({ step, children, style }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, delay: 80 + step * 130, easing: EASE, useNativeDriver: true }).start()
  }, [v, step])
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

function SectionTitle({ children }) {
  return (
    <View style={{ marginTop: 36, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Star size={14} color={DIAMOND_ICE} fill={DIAMOND_ICE} />
      <Text style={[font, { fontSize: 15, lineHeight: 20, fontWeight: "700", textTransform: "uppercase", letterSpacing: 4.8, color: colors.white }]}>{children}</Text>
      <Star size={14} color={DIAMOND_ICE} fill={DIAMOND_ICE} />
    </View>
  )
}

function IconTile({ icon: Icon }) {
  return (
    <View style={{ height: 48, width: 48, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: alpha("#ffffff", 0.06) }}>
      <Icon size={24} color={DIAMOND_ICE} strokeWidth={1.75} />
    </View>
  )
}

function LinkRow({ icon: Icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.8 }]}>
      <View style={{ height: 36, width: 36, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: alpha("#ffffff", 0.06) }}>
        <Icon size={18} color={colors.gray[300]} strokeWidth={1.75} />
      </View>
      <Text style={[font, { flex: 1, fontSize: 16, lineHeight: 22, color: colors.white }]}>{label}</Text>
      <ChevronRight size={20} color={colors.gray[500]} />
    </Pressable>
  )
}

function Bar({ style }) {
  const v = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return <Animated.View style={[{ borderRadius: 9999, backgroundColor: alpha("#ffffff", 0.07), opacity: v }, style]} />
}

function DiamondSkeleton({ top }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: top + 64 }}>
      <View style={{ alignItems: "center" }}>
        <Bar style={{ height: 28, width: 96 }} />
        <Bar style={{ marginTop: 12, height: 64, width: 288 }} />
        <Bar style={{ marginTop: 28, height: 16, width: 240 }} />
        <Bar style={{ marginTop: 12, height: 32, width: 176 }} />
      </View>
      <Bar style={{ alignSelf: "center", marginTop: 40, height: 16, width: 160 }} />
      <View style={{ marginTop: 20, gap: 24, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 24, backgroundColor: DIAMOND_CARD }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            <Bar style={{ height: 48, width: 48 }} />
            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
              <Bar style={{ height: 16, width: "40%" }} />
              <Bar style={{ height: 12, width: "80%" }} />
            </View>
          </View>
        ))}
      </View>
      <Bar style={{ marginTop: 32, height: 56, borderRadius: 16 }} />
    </View>
  )
}

export default function DiamondPage() {
  const navigate = useNavigate()
  const insets = useSafeAreaInsets()
  const [data, setData] = useState(() => getCachedDiamond())
  const [loading, setLoading] = useState(() => !getCachedDiamond())
  const [paying, setPaying] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef(null)
  const enter = useRef(new Animated.Value(0)).current
  const join = useRef(new Animated.Value(0)).current

  const load = useCallback(async () => {
    try {
      const fresh = await fetchDiamond()
      if (fresh) setData(fresh)
    } catch {
      if (!getCachedDiamond()) toast.error("Could not load Foodie Diamond")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const plan = data?.plan
  const membership = data?.membership
  const savings = data?.savings
  const isMember = Boolean(membership?.isMember)
  const canRenew = isMember && membership?.daysLeft <= 7
  const canBuy = (!isMember || canRenew) && plan?.enabled && plan?.price > 0

  // page: opacity 0 / x 28 -> in (0.35 s); join bar: y 24 -> 0 after 0.5 s
  useEffect(() => {
    if (loading || !data) return
    Animated.timing(enter, { toValue: 1, duration: 350, easing: EASE, useNativeDriver: true }).start()
  }, [loading, data, enter])
  useEffect(() => {
    if (!canBuy) return
    Animated.timing(join, { toValue: 1, duration: 400, delay: 500, easing: EASE, useNativeDriver: true }).start()
  }, [canBuy, join])

  const handleJoin = async () => {
    if (paying) return
    setPaying(true)
    try {
      const res = await userAPI.createDiamondOrder()
      const { razorpay, amount, durationLabel } = res?.data?.data || {}
      if (!razorpay?.orderId || !razorpay?.key) throw new Error("Failed to start payment")

      let user = {}
      try {
        const profile = await userAPI.getProfile()
        user = profile?.data?.data?.user || profile?.data?.user || {}
      } catch {
        // prefill is optional
      }
      const companyName = await getCompanyNameAsync()

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `Foodie Diamond · ${durationLabel || ""}`.trim(),
        prefill: {
          name: user.name || "",
          email: user.email || "",
          contact: String(user.phone || "").replace(/\D/g, "").slice(-10),
        },
        notes: { type: "diamond_membership", amount: String(amount) },
        handler: async (response) => {
          try {
            const verified = await userAPI.verifyDiamondPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            const next = verified?.data?.data || null
            setCachedDiamond(next)
            setData(next)
            scrollRef.current?.scrollTo({ y: 0, animated: true })
            toast.success(isMember ? "Diamond renewed" : "Welcome to Foodie Diamond")
          } catch (error) {
            toast.error(error?.response?.data?.message || "Payment verification failed. Please contact support.")
          } finally {
            setPaying(false)
          }
        },
        onError: (error) => {
          toast.error(error?.description || "Payment failed. Please try again.")
          setPaying(false)
        },
        onClose: () => setPaying(false),
      })
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Could not start payment")
      setPaying(false)
    }
  }

  const savingRows = savings
    ? [
        { key: "delivery", icon: Bike, title: "On delivery", amount: savings.delivery, count: savings.deliveryCount },
        { key: "discount", icon: BadgePercent, title: "Extra discount", amount: savings.discount, count: savings.discountCount },
        { key: "platform", icon: ReceiptText, title: "Platform fee", amount: savings.platformFee, count: savings.platformFeeCount },
      ].filter((row) => row.amount > 0)
    : []

  return (
    <View style={{ flex: 1, backgroundColor: DIAMOND_BG }}>
      <StatusBar style="light" />
      {/* Top bar: title fades in after scrolling past the logo */}
      <View style={[styles.topBar, { paddingTop: insets.top, height: 56 + insets.top, backgroundColor: scrolled ? DIAMOND_BG : "transparent" }]}>
        <Pressable onPress={() => navigate(-1)} accessibilityLabel="Back" style={({ pressed }) => [{ marginLeft: -2, padding: 6 }, pressed && { opacity: 0.6 }]}>
          <ArrowLeft size={24} color={colors.white} strokeWidth={1.75} />
        </Pressable>
        <Text style={[font, { fontSize: 19, lineHeight: 24, fontWeight: "600", color: colors.white, opacity: scrolled ? 1 : 0 }]}>Foodie Diamond</Text>
      </View>

      {loading ? (
        <DiamondSkeleton top={insets.top} />
      ) : !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 }}>
          <Text style={[font, { color: colors.gray[300], textAlign: "center" }]}>Could not load Foodie Diamond.</Text>
          <Pressable onPress={load}>
            <Text style={[font, { fontWeight: "600", color: DIAMOND_ICE }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 120)}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingBottom: (canBuy ? 144 : 48) + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ paddingHorizontal: 16, opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
            {/* Header */}
            <View style={{ marginHorizontal: -16, overflow: "hidden", paddingHorizontal: 16, paddingBottom: 8, paddingTop: 64 + insets.top }}>
              <DiamondPattern corner />
              <View style={{ alignItems: "center" }}>
                <Reveal step={0}>
                  <DiamondWordmark />
                </Reveal>
                <Reveal step={1} style={{ alignItems: "center" }}>
                  {isMember ? (
                    <Text style={[font, styles.memberTill]}>Member till {formatMemberDate(membership.endAt)}</Text>
                  ) : plan.enabled && plan.price > 0 ? (
                    <>
                      <Text style={[font, styles.pitch]}>
                        {plan.benefits[0]?.title && plan.benefits[1]?.title
                          ? `${plan.benefits[0].title} & ${plan.benefits[1].title.toLowerCase()} on every order`
                          : "Exclusive savings on every order"}
                      </Text>
                      <View style={{ marginTop: 16, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text style={[font, { fontSize: 30, lineHeight: 36, fontWeight: "800", color: DIAMOND_ICE }]}>{formatINR(plan.price)}</Text>
                        {plan.originalPrice > 0 && (
                          <Text style={[font, { fontSize: 16, lineHeight: 22, color: colors.gray[500], textDecorationLine: "line-through" }]}>{formatINR(plan.originalPrice)}</Text>
                        )}
                        <Text style={[font, { fontSize: 15, lineHeight: 20, color: colors.gray[400] }]}>for {plan.durationLabel}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[font, { marginTop: 24, fontSize: 16, lineHeight: 22, color: colors.gray[300] }]}>Foodie Diamond is coming soon.</Text>
                  )}
                </Reveal>
              </View>
            </View>

            {/* Savings (members) */}
            {isMember && (
              <>
                <Reveal step={2}>
                  <SectionTitle>Savings till now</SectionTitle>
                </Reveal>
                <Reveal step={3}>
                  {savingRows.length ? (
                    <View style={{ gap: 12 }}>
                      {savingRows.map(({ key, icon, title, amount, count }) => (
                        <View key={key} style={styles.savingRow}>
                          <IconTile icon={icon} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[font, { fontSize: 18, lineHeight: 22, fontWeight: "600", color: colors.white }]}>{title}</Text>
                            <Text style={[font, { marginTop: 2, fontSize: 15, lineHeight: 20, color: colors.gray[400] }]}>
                              Used {count} {count === 1 ? "time" : "times"}
                            </Text>
                          </View>
                          <Text style={[font, { fontSize: 22, lineHeight: 28, fontWeight: "600", color: DIAMOND_ICE }]}>{formatINR(amount)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.card, { paddingVertical: 20, alignItems: "center" }]}>
                      <Text style={[font, { fontSize: 15, lineHeight: 20, color: colors.gray[400], textAlign: "center" }]}>
                        Your Diamond savings will show here after your first order.
                      </Text>
                    </View>
                  )}
                </Reveal>
              </>
            )}

            {/* Benefits */}
            {plan.benefits.length > 0 && (
              <>
                <Reveal step={isMember ? 4 : 2}>
                  <SectionTitle>{isMember ? "Current benefits" : "What you get"}</SectionTitle>
                </Reveal>
                <Reveal step={isMember ? 5 : 3}>
                  <View style={[styles.card, { gap: 28, paddingVertical: 24 }]}>
                    {plan.benefits.map((benefit) => (
                      <View key={benefit.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
                        <IconTile icon={BENEFIT_ICONS[benefit.key] || Sparkles} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[font, { fontSize: 19, lineHeight: 25, fontWeight: "600", color: colors.white }]}>{benefit.title}</Text>
                          {benefit.description ? (
                            <Text style={[font, { marginTop: 6, fontSize: 16, lineHeight: 26, color: colors.gray[400] }]}>{benefit.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </Reveal>
              </>
            )}

            <Reveal step={isMember ? 6 : 4} style={{ marginTop: 32, gap: 12 }}>
              {plan.hasTerms && <LinkRow icon={Info} label="Terms and Conditions" onPress={() => navigate("/food/user/diamond/terms")} />}
              <LinkRow icon={MessageSquareText} label="Need help? Chat with us" onPress={() => navigate("/food/user/diamond/support")} />
            </Reveal>
          </Animated.View>
        </ScrollView>
      )}

      {/* Join */}
      {canBuy && !loading && (
        <Animated.View
          style={[
            styles.joinBar,
            { paddingBottom: insets.bottom + 14, opacity: join, transform: [{ translateY: join.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
          ]}
        >
          <Pressable onPress={handleJoin} disabled={paying} style={({ pressed }) => [{ borderRadius: 16, overflow: "hidden" }, (pressed || paying) && { opacity: paying ? 0.7 : 0.9 }]}>
            <LinearGradient colors={DIAMOND_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.joinBtn}>
              {paying ? (
                <Spin>
                  <Loader2 size={20} color="#06202C" />
                </Spin>
              ) : null}
              <Text style={[font, { fontSize: 17, lineHeight: 22, fontWeight: "700", color: "#06202C" }]}>
                {paying ? "Opening payment…" : `${canRenew ? "Renew Diamond" : "Join Diamond"} for ${formatINR(plan.price)}`}
              </Text>
            </LinearGradient>
          </Pressable>
          <Text style={[font, { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 16, color: colors.gray[500] }]}>
            {canRenew ? `Adds ${plan.durationLabel} after your current membership ends` : `Valid for ${plan.durationLabel} from the day you join`}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 30, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 },
  memberTill: { marginTop: 28, fontSize: 17, lineHeight: 28, fontWeight: "600", textTransform: "uppercase", letterSpacing: 5.1, color: DIAMOND_ICE, textAlign: "center" },
  pitch: { marginTop: 24, maxWidth: 300, fontSize: 17, lineHeight: 23, color: colors.gray[200], textAlign: "center" },
  card: { borderRadius: 16, paddingHorizontal: 16, backgroundColor: DIAMOND_CARD },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: DIAMOND_CARD },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: DIAMOND_CARD },
  joinBar: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30, borderTopWidth: 1, borderTopColor: alpha("#ffffff", 0.05), paddingHorizontal: 16, paddingTop: 12, backgroundColor: DIAMOND_BG },
  joinBtn: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
})
