// Web: modules/DeliveryV2/pages/profile/ReferEarnV2.jsx (/food/delivery/profile/refer) — the partner's referral
// code, invite / copy link, progress, reward per referral, how it works and the invited partners.
// Native:
// - navigator.clipboard / execCommand -> expo-clipboard;
// - navigator.share({ text }) -> the system share sheet (Share.share); WhatsApp fallback not needed;
// - the fixed white header is a normal header above the ScrollView.
import React, { useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native"
import * as Clipboard from "expo-clipboard"
import { ArrowLeft, Check, Copy, Link2, Share2 } from "lucide-react-native"
import { toast } from "@/lib/toast"
import { useNavigate } from "@/lib/router"
import { Screen, Text } from "@/native/ui"
import { colors, fonts, shadow } from "@/theme"
import { deliveryAPI } from "@food/api"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
import { buildDeliveryReferralLink } from "../../utils/deliveryReferral"

const BLUE = "#0E4B9C"

const ordinal = (n) => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`
}

const formatINR = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

const STATUS = {
  credited: { label: "Reward added", color: colors.emerald[700] },
  pending_approval: { label: "Waiting for approval", color: colors.amber[700] },
  approved: { label: "Approved", color: colors.sky[700] },
  not_eligible: { label: "No reward", color: colors.gray[500] },
  application_rejected: { label: "Not approved", color: colors.rose[600] },
}

const STEPS = [
  { title: "Share your invite", text: "Send your link or code to friends who want to deliver." },
  { title: "Your friend signs up", text: "They register as a delivery partner with your code." },
  { title: "You get paid", text: "When their documents are approved, the reward is added to your pocket." },
]

/** One-line description of the reward plan, e.g. "₹200 for every partner you refer, up to 5 partners." */
const describePlan = (data) => {
  const amounts = [...(data.ladder?.rows || []).map((r) => r.amount)]
  if (data.ladder?.afterTiers) amounts.push(data.ladder.afterTiers.amount)
  const max = data.maxReferrals
  const limit = `up to ${max} partner${max === 1 ? "" : "s"}`
  if (amounts.length && amounts.every((a) => a === amounts[0])) {
    return `${formatINR(amounts[0])} for every partner you refer, ${limit}.`
  }
  return `Get paid for every partner you refer, ${limit}.`
}

const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>

const NextTag = () => (
  <View style={s.nextTag}>
    <Text style={s.nextTagText}>Next</Text>
  </View>
)

export const ReferEarnV2 = () => {
  const goBack = useDeliveryBackNavigation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState("")
  const copiedTimer = useRef(null)

  useEffect(() => {
    let alive = true
    deliveryAPI
      .getReferralDetails()
      .then((res) => {
        if (!alive) return
        const details = res?.data?.data || null
        if (details && details.visible === false) {
          // Admin turned Refer & Earn off in Customization Settings
          navigate("/food/delivery/profile", { replace: true })
          return
        }
        setData(details)
      })
      .catch(() => toast.error("Failed to load Refer & Earn"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
      clearTimeout(copiedTimer.current)
    }
  }, [navigate])

  const code = data?.code || ""
  const link = data?.shareLink || buildDeliveryReferralLink(code)
  const message =
    data?.shareMessage ||
    `Hey! I deliver with Foodie and earn on my own schedule.\nJoin as a delivery partner using my referral code ${code}.\n\nSign up here: ${link}`

  const handleCopy = async (what) => {
    try {
      await Clipboard.setStringAsync(what === "code" ? code : link)
    } catch {
      return
    }
    setCopied(what)
    toast.success(what === "code" ? "Code copied" : "Invite link copied")
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(""), 2000)
  }

  const handleShare = async () => {
    if (!code) return
    try {
      // The message already contains the link; passing `url` too makes some apps show it twice.
      await Share.share({ message })
    } catch {
      // share sheet closed
    }
  }

  const ladderRows = data?.ladder?.rows || []
  const afterTiers = data?.ladder?.afterTiers
  const referralCount = data?.referralCount || 0
  const nextNumber = referralCount + 1
  const progress = data?.maxReferrals ? Math.min(100, (referralCount / data.maxReferrals) * 100) : 0

  return (
    <Screen bg={colors.gray[100]} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={goBack} hitSlop={8} style={s.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={24} color={colors.gray[950] || "#030712"} />
        </Pressable>
        <Text style={s.headerTitle}>Refer & Earn</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <View style={[s.skel, { height: 256 }]} />
            <View style={[s.skel, { height: 96 }]} />
            <View style={[s.skel, { height: 160 }]} />
          </View>
        ) : !data ? (
          <Card style={{ paddingVertical: 32 }}>
            <Text style={[s.muted, { textAlign: "center" }]}>Could not load Refer & Earn. Try again later.</Text>
          </Card>
        ) : (
          <>
            {/* Offer + code */}
            <Card style={{ padding: 20 }}>
              {data.enabled ? (
                <>
                  <Text style={s.muted}>Invite friends to deliver with Foodie</Text>
                  <Text style={s.bigTitle}>{`Earn up to ${formatINR(data.maxEarning)}`}</Text>
                  <Text style={s.body}>{describePlan(data)}</Text>
                </>
              ) : (
                <>
                  <Text style={s.pausedTitle}>Referral rewards are paused</Text>
                  <Text style={s.body}>You can still invite friends with your code.</Text>
                </>
              )}

              <View style={s.codeBox}>
                <View>
                  <Text style={s.small}>Your referral code</Text>
                  <Text style={s.code}>{code}</Text>
                </View>
                <Pressable onPress={() => handleCopy("code")} style={({ pressed }) => [s.copyBtn, pressed && { backgroundColor: colors.blue[50] }]}>
                  {copied === "code" ? <Check size={16} color={BLUE} /> : <Copy size={16} color={BLUE} />}
                  <Text style={s.copyText}>{copied === "code" ? "Copied" : "Copy"}</Text>
                </Pressable>
              </View>

              <Pressable onPress={handleShare} style={({ pressed }) => [s.inviteBtn, pressed && { opacity: 0.9 }]}>
                <Share2 size={16} color={colors.white} />
                <Text style={s.inviteText}>Invite friends</Text>
              </Pressable>
              <Pressable onPress={() => handleCopy("link")} style={({ pressed }) => [s.linkBtn, pressed && { backgroundColor: colors.gray[50] }]}>
                {copied === "link" ? <Check size={16} color={colors.gray[700]} /> : <Link2 size={16} color={colors.gray[700]} />}
                <Text style={s.linkText}>{copied === "link" ? "Link copied" : "Copy invite link"}</Text>
              </Pressable>
            </Card>

            {/* Progress */}
            <Card>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{`${referralCount}${data.maxReferrals ? ` of ${data.maxReferrals}` : ""} referrals`}</Text>
                <Text style={s.mutedSm}>
                  {"Earned "}
                  <Text style={[s.mutedSm, { fontWeight: "600", color: colors.emerald[700] }]}>{formatINR(data.totalReferralEarnings)}</Text>
                </Text>
              </View>
              {data.maxReferrals > 0 ? (
                <View style={s.track}>
                  <View style={[s.fill, { width: `${progress}%` }]} />
                </View>
              ) : null}
              <Text style={[s.bodySm, { marginTop: 12 }]}>
                {data.enabled && data.remaining > 0 ? (
                  <>
                    {`Your ${ordinal(nextNumber)} referral earns `}
                    <Text style={[s.bodySm, { fontWeight: "600", color: colors.gray[900] }]}>{formatINR(data.nextReward)}</Text>
                  </>
                ) : data.enabled ? (
                  "You have used all your referrals."
                ) : (
                  "Rewards will show here when referrals are back on."
                )}
              </Text>
              {data.pendingCount > 0 ? (
                <Text style={[s.bodySm, { marginTop: 4, color: colors.amber[700] }]}>
                  {`${data.pendingCount} ${data.pendingCount === 1 ? "friend is" : "friends are"} waiting for approval`}
                </Text>
              ) : null}
            </Card>

            {/* Reward per referral */}
            {data.enabled && (ladderRows.length > 0 || afterTiers) ? (
              <Card>
                <Text style={[s.cardTitle, { marginBottom: 4 }]}>Reward for each referral</Text>
                {ladderRows.map((row, i) => {
                  const done = row.referralNumber <= referralCount
                  const isNext = row.referralNumber === nextNumber
                  return (
                    <View key={row.referralNumber} style={[s.ladderRow, i > 0 && s.divider]}>
                      <View style={s.ladderLeft}>
                        <Text style={[s.ladderText, { color: done ? colors.gray[400] : colors.gray[700] }]}>{`${ordinal(row.referralNumber)} referral`}</Text>
                        {done ? <Check size={16} color={colors.emerald[600]} /> : null}
                        {isNext ? <NextTag /> : null}
                      </View>
                      <Text style={[s.ladderAmount, { color: done ? colors.gray[400] : colors.gray[900] }]}>{formatINR(row.amount)}</Text>
                    </View>
                  )
                })}
                {afterTiers ? (
                  <View style={[s.ladderRow, ladderRows.length > 0 && s.divider]}>
                    <View style={s.ladderLeft}>
                      <Text style={[s.ladderText, { color: colors.gray[700] }]}>
                        {afterTiers.fromReferral === afterTiers.toReferral
                          ? `${ordinal(afterTiers.fromReferral)} referral`
                          : `${ordinal(afterTiers.fromReferral)} to ${ordinal(afterTiers.toReferral)} referral`}
                      </Text>
                      {nextNumber >= afterTiers.fromReferral && nextNumber <= afterTiers.toReferral ? <NextTag /> : null}
                    </View>
                    <Text style={[s.ladderAmount, { color: colors.gray[900] }]}>
                      {`${formatINR(afterTiers.amount)}${afterTiers.fromReferral !== afterTiers.toReferral ? " each" : ""}`}
                    </Text>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* How it works */}
            <Card>
              <Text style={[s.cardTitle, { marginBottom: 12 }]}>How it works</Text>
              <View style={{ gap: 16 }}>
                {STEPS.map(({ title, text }, idx) => (
                  <View key={title} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={s.stepNum}>
                      <Text style={s.stepNumText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stepTitle}>{title}</Text>
                      <Text style={s.stepText}>{text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Invited partners */}
            <Card>
              <Text style={s.cardTitle}>{`Your referrals${data.invited?.length ? ` (${data.invited.length})` : ""}`}</Text>
              {!data.invited?.length ? (
                <Text style={[s.mutedSm, { paddingVertical: 16 }]}>No one has joined with your code yet.</Text>
              ) : (
                <View style={{ marginTop: 4 }}>
                  {data.invited.map((item, i) => {
                    const status = STATUS[item.status] || STATUS.pending_approval
                    return (
                      <View key={item.id || i} style={[s.invRow, i > 0 && s.divider]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={s.invName}>{item.name}</Text>
                          <Text style={s.small}>
                            {`${item.phone || ""}${
                              item.joinedAt
                                ? ` · Joined ${new Date(item.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                                : ""
                            }`}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          {item.status === "credited" ? <Text style={s.invReward}>{`+${formatINR(item.rewardAmount)}`}</Text> : null}
                          <Text style={[s.invStatus, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </Card>

            <Text style={s.footNote}>
              A referral counts once your friend signs up with your code and is approved. Each person can be referred only
              once. Rewards go to your pocket balance.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

export default ReferEarnV2

const s = StyleSheet.create({
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
    ...shadow.sm,
    zIndex: 2,
  },
  backBtn: { padding: 4, borderRadius: 9999 },
  headerTitle: { fontFamily: fonts.poppins, fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#030712" },
  content: { padding: 16, paddingBottom: 96, gap: 12 },
  skel: { borderRadius: 16, backgroundColor: colors.gray[200] },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  muted: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, color: colors.gray[500] },
  mutedSm: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, color: colors.gray[500] },
  small: { fontFamily: fonts.poppins, fontSize: 12, lineHeight: 16, color: colors.gray[500] },
  bigTitle: { fontFamily: fonts.poppins, marginTop: 4, fontSize: 26, lineHeight: 32, fontWeight: "700", color: colors.gray[900] },
  pausedTitle: { fontFamily: fonts.poppins, fontSize: 20, lineHeight: 26, fontWeight: "700", color: colors.gray[900] },
  body: { fontFamily: fonts.poppins, marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.gray[600] },
  bodySm: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, color: colors.gray[600] },
  codeBox: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(14,75,156,0.4)",
    backgroundColor: "rgba(14,75,156,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  code: { fontFamily: fonts.poppins, fontSize: 18, lineHeight: 28, fontWeight: "700", letterSpacing: 0.5, color: colors.gray[900] },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  copyText: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600", color: BLUE },
  inviteBtn: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, backgroundColor: BLUE },
  inviteText: { fontFamily: fonts.poppins, fontSize: 15, lineHeight: 22, fontWeight: "600", color: colors.white },
  linkBtn: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 10 },
  linkText: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.gray[700] },
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.poppins, fontSize: 15, lineHeight: 22, fontWeight: "600", color: colors.gray[900] },
  track: { marginTop: 12, height: 6, borderRadius: 9999, backgroundColor: colors.gray[100], overflow: "hidden" },
  fill: { height: "100%", borderRadius: 9999, backgroundColor: BLUE },
  ladderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.gray[100] },
  ladderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  ladderText: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20 },
  ladderAmount: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  nextTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(14,75,156,0.08)" },
  nextTagText: { fontFamily: fonts.poppins, fontSize: 11, lineHeight: 14, fontWeight: "600", color: BLUE },
  stepNum: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.gray[300], alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: fonts.poppins, fontSize: 12, lineHeight: 16, fontWeight: "600", color: colors.gray[700] },
  stepTitle: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.gray[900] },
  stepText: { fontFamily: fonts.poppins, fontSize: 13, lineHeight: 21, color: colors.gray[500] },
  invRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  invName: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.gray[900] },
  invReward: { fontFamily: fonts.poppins, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.emerald[700] },
  invStatus: { fontFamily: fonts.poppins, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  footNote: { fontFamily: fonts.poppins, paddingHorizontal: 4, paddingTop: 4, fontSize: 12, lineHeight: 19, color: colors.gray[500] },
})
