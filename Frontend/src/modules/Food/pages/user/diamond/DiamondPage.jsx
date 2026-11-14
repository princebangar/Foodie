import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, BadgePercent, Bike, ChevronRight, Info, Loader2, MessageSquareText, ReceiptText, Sparkles, Star } from "lucide-react"
import { toast } from "sonner"
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

const EASE = [0.22, 1, 0.36, 1]

/** Sections fade up one after another, top to bottom, like the Zomato Gold page. */
function Reveal({ step, children, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.08 + step * 0.13 }}
    >
      {children}
    </motion.div>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="mt-9 mb-4 flex items-center justify-center gap-3">
      <Star className="h-3.5 w-3.5 fill-current" style={{ color: DIAMOND_ICE }} />
      <h2 className="text-[15px] font-bold uppercase tracking-[0.32em] text-white">{children}</h2>
      <Star className="h-3.5 w-3.5 fill-current" style={{ color: DIAMOND_ICE }} />
    </div>
  )
}

function IconTile({ icon: Icon }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
      <Icon className="h-6 w-6" style={{ color: DIAMOND_ICE }} strokeWidth={1.75} />
    </span>
  )
}

function LinkRow({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left active:opacity-80"
      style={{ background: DIAMOND_CARD }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
        <Icon className="h-[18px] w-[18px] text-gray-300" strokeWidth={1.75} />
      </span>
      <span className="flex-1 text-[16px] text-white">{label}</span>
      <ChevronRight className="h-5 w-5 text-gray-500" />
    </button>
  )
}

function DiamondSkeleton() {
  const bar = "animate-pulse rounded-full bg-white/[0.07]"
  return (
    <div className="mx-auto max-w-md px-4 pt-16" aria-busy="true">
      <div className="flex flex-col items-center">
        <div className={`${bar} h-7 w-24`} />
        <div className={`${bar} mt-3 h-16 w-72`} />
        <div className={`${bar} mt-7 h-4 w-60`} />
        <div className={`${bar} mt-3 h-8 w-44`} />
      </div>
      <div className={`${bar} mx-auto mt-10 h-4 w-40`} />
      <div className="mt-5 space-y-6 rounded-2xl px-4 py-6" style={{ background: DIAMOND_CARD }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-white/[0.07]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className={`${bar} h-4 w-2/5`} />
              <div className={`${bar} h-3 w-4/5`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 h-14 animate-pulse rounded-2xl" style={{ background: DIAMOND_CARD }} />
    </div>
  )
}

export default function DiamondPage() {
  const navigate = useNavigate()
  // Cached copy draws instantly; a fresh one replaces it in the background.
  const [data, setData] = useState(() => getCachedDiamond())
  const [loading, setLoading] = useState(() => !getCachedDiamond())
  const [paying, setPaying] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const plan = data?.plan
  const membership = data?.membership
  const savings = data?.savings
  const isMember = Boolean(membership?.isMember)
  const canBuy = !isMember && plan?.enabled && plan?.price > 0

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
            window.scrollTo({ top: 0, behavior: "smooth" })
            toast.success("Welcome to Foodie Diamond")
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
    <div className="min-h-screen text-white" style={{ background: DIAMOND_BG, fontFamily: DIAMOND_FONT }}>
      {/* Top bar: title fades in after scrolling past the logo, like Zomato Gold */}
      <div
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 px-3 transition-colors duration-200"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          boxSizing: "content-box",
          background: scrolled ? DIAMOND_BG : "transparent",
        }}
      >
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="-ml-0.5 p-1.5 outline-none [-webkit-tap-highlight-color:transparent] active:opacity-60">
          <ArrowLeft className="h-6 w-6" strokeWidth={1.75} />
        </button>
        <span className={`text-[19px] font-semibold transition-opacity duration-200 ${scrolled ? "opacity-100" : "opacity-0"}`}>
          Foodie Diamond
        </span>
      </div>

      {loading ? (
        <DiamondSkeleton />
      ) : !data ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-gray-300">Could not load Foodie Diamond.</p>
          <button type="button" onClick={load} className="font-semibold" style={{ color: DIAMOND_ICE }}>
            Try again
          </button>
        </div>
      ) : (
        <motion.div
          className={`mx-auto max-w-md px-4 ${canBuy ? "pb-36" : "pb-12"}`}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {/* Header */}
          <div className="relative -mx-4 overflow-hidden px-4 pb-2 pt-16">
            <DiamondPattern corner />
            <div className="relative flex flex-col items-center text-center">
              <Reveal step={0}>
                <DiamondWordmark />
              </Reveal>
              <Reveal step={1} className="flex flex-col items-center">
              {isMember ? (
                <p className="mt-7 text-[17px] font-semibold uppercase leading-relaxed tracking-[0.3em]" style={{ color: DIAMOND_ICE }}>
                  Member till {formatMemberDate(membership.endAt)}
                </p>
              ) : plan.enabled && plan.price > 0 ? (
                <>
                  <p className="mt-6 max-w-[300px] text-[17px] leading-snug text-gray-200">
                    {plan.benefits[0]?.title && plan.benefits[1]?.title
                      ? `${plan.benefits[0].title} & ${plan.benefits[1].title.toLowerCase()} on every order`
                      : "Exclusive savings on every order"}
                  </p>
                  <p className="mt-4 flex items-baseline gap-2">
                    <span className="text-[30px] font-extrabold" style={{ color: DIAMOND_ICE }}>{formatINR(plan.price)}</span>
                    {plan.originalPrice > 0 && <span className="text-[16px] text-gray-500 line-through">{formatINR(plan.originalPrice)}</span>}
                    <span className="text-[15px] text-gray-400">for {plan.durationLabel}</span>
                  </p>
                </>
              ) : (
                <p className="mt-6 text-[16px] text-gray-300">Foodie Diamond is coming soon.</p>
              )}
              </Reveal>
            </div>
          </div>

          {/* Savings (members) */}
          {isMember && (
            <>
              <Reveal step={2}>
                <SectionTitle>Savings till now</SectionTitle>
              </Reveal>
              <Reveal step={3}>
              {savingRows.length ? (
                <div className="space-y-3">
                  {savingRows.map(({ key, icon, title, amount, count }) => (
                    <div key={key} className="flex items-center gap-3 rounded-2xl px-3 py-3.5" style={{ background: DIAMOND_CARD }}>
                      <IconTile icon={icon} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-semibold leading-tight">{title}</p>
                        <p className="mt-0.5 text-[15px] text-gray-400">
                          Used {count} {count === 1 ? "time" : "times"}
                        </p>
                      </div>
                      <span className="text-[22px] font-semibold" style={{ color: DIAMOND_ICE }}>{formatINR(amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl px-4 py-5 text-center text-[15px] text-gray-400" style={{ background: DIAMOND_CARD }}>
                  Your Diamond savings will show here after your first order.
                </div>
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
              <div className="space-y-7 rounded-2xl px-4 py-6" style={{ background: DIAMOND_CARD }}>
                {plan.benefits.map((benefit) => (
                  <div key={benefit.key} className="flex items-start gap-4">
                    <IconTile icon={BENEFIT_ICONS[benefit.key] || Sparkles} />
                    <div className="min-w-0">
                      <p className="text-[19px] font-semibold leading-snug">{benefit.title}</p>
                      {benefit.description && <p className="mt-1.5 text-[16px] leading-relaxed text-gray-400">{benefit.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
              </Reveal>
            </>
          )}

          <Reveal step={isMember ? 6 : 4} className="mt-8 space-y-3">
            {plan.hasTerms && <LinkRow icon={Info} label="Terms and Conditions" onClick={() => navigate("/food/user/diamond/terms")} />}
            <LinkRow icon={MessageSquareText} label="Need help? Chat with us" onClick={() => navigate("/food/user/diamond/support")} />
          </Reveal>
        </motion.div>
      )}

      {/* Join */}
      {canBuy && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.5 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 px-4 pt-3"
          style={{ background: DIAMOND_BG, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
        >
          <button
            type="button"
            onClick={handleJoin}
            disabled={paying}
            className="mx-auto flex h-[54px] w-full max-w-md items-center justify-center gap-2 rounded-2xl text-[17px] font-bold text-[#06202C] active:opacity-90 disabled:opacity-70"
            style={{ backgroundImage: DIAMOND_BUTTON }}
          >
            {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {paying ? "Opening payment…" : `Join Diamond for ${formatINR(plan.price)}`}
          </button>
          <p className="mt-2 text-center text-[12px] text-gray-500">Valid for {plan.durationLabel} from the day you join</p>
        </motion.div>
      )}
    </div>
  )
}
