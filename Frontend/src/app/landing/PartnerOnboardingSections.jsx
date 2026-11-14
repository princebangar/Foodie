import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion"
import { openAppStore } from "./appLinks"
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bike,
  Camera,
  CheckCircle2,
  FileText,
  IdCard,
  Landmark,
  MapPin,
  Smartphone,
  Store,
  User,
  UtensilsCrossed,
  Zap,
} from "lucide-react"

const STEP_MS = 3200
const BRAND = "#D32F2F"
const EASE_OUT = [0.22, 1, 0.36, 1]
const REVEAL_VIEWPORT = { once: true, amount: 0.2 }

const RESTAURANT_STEPS = [
  { title: "Login with mobile", description: "Verify your number with a quick OTP.", icon: Smartphone },
  { title: "Add restaurant details", description: "Name, owner details, contact and location.", icon: Store },
  { title: "Upload menu & documents", description: "Menu photos, PAN, GST, FSSAI and bank details.", icon: FileText },
  { title: "Get verified & go live", description: "Our team reviews it and you start taking orders.", icon: BadgeCheck },
]

const DELIVERY_STEPS = [
  { title: "Login with mobile", description: "Enter your number and verify the OTP.", icon: Smartphone },
  { title: "Fill basic details", description: "Your name, vehicle and ID numbers.", icon: User },
  { title: "Upload documents", description: "Profile photo, Aadhar, PAN and driving license.", icon: Camera },
  { title: "Go online & earn", description: "Once approved, switch on and start delivering.", icon: Bike },
]

/** Moves through the steps on a timer while the section is on screen. */
function useStepCycle(length, ref) {
  const [active, setActive] = useState(0)
  const inView = useInView(ref, { amount: 0.35 })
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!inView || reduceMotion) return undefined
    const timer = setTimeout(() => setActive((i) => (i + 1) % length), STEP_MS)
    return () => clearTimeout(timer)
  }, [active, inView, reduceMotion, length])

  return [active, setActive, inView && !reduceMotion]
}

function StepList({ steps, active, onSelect, playing }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, idx) => {
        const isActive = idx === active
        const isDone = idx < active
        return (
          <li key={step.title}>
            <button
              type="button"
              onClick={() => onSelect(idx)}
              className={`relative w-full overflow-hidden text-left flex items-center gap-3.5 rounded-2xl border px-4 py-3 transition-colors duration-300 ${
                isActive ? "border-[#D32F2F]/60 bg-white/[0.06]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                  isActive || isDone ? "bg-[#D32F2F] text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#333]"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
              </span>
              <span className="flex-1">
                <span className={`block text-[15px] font-bold ${isActive ? "text-white" : "text-gray-300"}`}>{step.title}</span>
                <span className="block text-[13px] text-gray-400 mt-0.5">{step.description}</span>
              </span>
              <step.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#D32F2F]" : "text-gray-600"}`} />
              {isActive && playing && (
                <motion.span
                  key={`progress-${active}`}
                  className="absolute inset-x-0 bottom-0 h-[3px] bg-[#D32F2F] origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                />
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- small animated building blocks ---------- */

function FillBar({ delay = 0, width = "100%" }) {
  return (
    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gray-300"
        initial={{ width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.7, delay, ease: "easeOut" }}
      />
    </div>
  )
}

function Field({ label, delay, width }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{label}</p>
      <div className="rounded-xl border border-gray-200 px-3 py-2.5">
        <FillBar delay={delay} width={width} />
      </div>
    </div>
  )
}

function OtpScene({ title }) {
  return (
    <div className="space-y-5">
      <p className="text-lg font-bold text-gray-900">{title}</p>
      <div>
        <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Mobile number</p>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 font-semibold">
          <span className="text-gray-400">+91</span>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            98XXX XXX10
          </motion.span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Enter OTP</p>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-11 h-12 rounded-xl border border-gray-200 flex items-center justify-center">
              <motion.span
                className="w-2.5 h-2.5 rounded-full bg-gray-800"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 + i * 0.25, type: "spring", stiffness: 400, damping: 15 }}
              />
            </div>
          ))}
        </div>
      </div>
      <motion.div
        className="rounded-xl py-3 text-center text-sm font-bold text-white"
        style={{ backgroundColor: BRAND }}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1, scale: [1, 1.04, 1] }}
        transition={{ delay: 1.7, duration: 0.5 }}
      >
        Verify & Continue
      </motion.div>
    </div>
  )
}

function DocumentRows({ items }) {
  return (
    <div className="space-y-3">
      {items.map(({ label, icon: Icon }, i) => (
        <motion.div
          key={label}
          className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.2 }}
        >
          <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" style={{ color: BRAND }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 mb-1.5">{label}</p>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.3 + i * 0.35, duration: 0.6 }}
              />
            </div>
          </div>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9 + i * 0.35, type: "spring", stiffness: 400, damping: 14 }}
          >
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </motion.span>
        </motion.div>
      ))}
    </div>
  )
}

function SuccessBadge({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center text-center pt-2">
      <div className="relative w-24 h-24 mb-5">
        <motion.span
          className="absolute inset-0 rounded-full bg-green-400/30"
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.span
          className="absolute inset-0 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </motion.span>
      </div>
      <p className="text-lg font-bold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  )
}

function Toast({ icon: Icon, title, subtitle, delay = 0.8 }) {
  return (
    <motion.div
      className="mt-6 flex items-center gap-3 rounded-2xl bg-gray-900 text-white p-3 shadow-xl"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 20 }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND }}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </motion.div>
  )
}

/** The white "app screen" the scenes are drawn in. */
function PhoneCard({ header, step, children }) {
  return (
    <div className="relative w-full max-w-[390px] mx-auto rounded-[36px] bg-white text-gray-900 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)] border-[6px] border-[#1E1E1E] min-h-[510px] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <img src="/logo-icon.webp" alt="" className="w-6 h-6 object-contain" />
          {header}
        </span>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50" style={{ color: BRAND }}>
          Step {step + 1}/4
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------- restaurant ---------- */

function RestaurantScene({ step }) {
  if (step === 0) return <OtpScene title="Welcome, partner!" />
  if (step === 1) {
    return (
      <div className="space-y-4">
        <p className="text-lg font-bold text-gray-900">Restaurant details</p>
        <Field label="Restaurant name" delay={0.1} width="70%" />
        <Field label="Owner name" delay={0.4} width="55%" />
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Location</p>
          <div className="relative h-28 rounded-xl overflow-hidden bg-[#EAF2E8] border border-gray-200">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 2px, transparent 2px), linear-gradient(90deg, #fff 2px, transparent 2px)",
                backgroundSize: "28px 28px",
              }}
            />
            <motion.span
              className="absolute left-1/2 top-1/2 -translate-x-1/2"
              initial={{ y: -70, opacity: 0 }}
              animate={{ y: -28, opacity: 1 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 300, damping: 12 }}
            >
              <MapPin className="w-8 h-8 drop-shadow" style={{ color: BRAND }} fill="#fff" />
            </motion.span>
          </div>
        </div>
      </div>
    )
  }
  if (step === 2) {
    return (
      <div className="space-y-4">
        <p className="text-lg font-bold text-gray-900">Menu & documents</p>
        <DocumentRows
          items={[
            { label: "Menu photos", icon: UtensilsCrossed },
            { label: "PAN & GST", icon: FileText },
            { label: "FSSAI license", icon: BadgeCheck },
            { label: "Bank account", icon: Landmark },
          ]}
        />
      </div>
    )
  }
  return (
    <div>
      <SuccessBadge title="You're live on Foodie!" subtitle="Customers can now find your restaurant." />
      <Toast icon={Bell} title="New order received" subtitle="2 items · Takeaway" />
    </div>
  )
}

export function RestaurantOnboardingSection() {
  const ref = useRef(null)
  const [active, setActive, playing] = useStepCycle(RESTAURANT_STEPS.length, ref)

  return (
    <section id="partner-restaurant" ref={ref} className="pt-4 md:pt-6 pb-8 md:pb-10 px-6 bg-[#0B0B0B] relative overflow-hidden">
      <div className="absolute top-1/2 -translate-y-1/2 -right-64 w-[720px] h-[720px] rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(211,47,47,0.12),transparent_60%)]" />
      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D32F2F]/40 bg-[#D32F2F]/10 px-4 py-1.5 text-sm font-semibold text-[#FF6B6B] mb-5">
            <Store className="w-4 h-4" /> Become a Restaurant Partner
          </span>
          <h2 className="text-3xl md:text-[42px] font-black mb-3 leading-tight">
            Grow your restaurant with <span className="text-[#D32F2F]">Foodie</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg mb-7 max-w-xl">
            Reach more customers for dine-in and takeaway. Register your restaurant online in four easy steps.
          </p>

          <StepList steps={RESTAURANT_STEPS} active={active} onSelect={setActive} playing={playing} />

          <button
            type="button"
            onClick={() => openAppStore("restaurant")}
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#D32F2F] px-7 py-3.5 font-bold text-white shadow-lg shadow-[#D32F2F]/30 hover:bg-[#B71C1C] hover:-translate-y-0.5 transition-all"
          >
            Register your restaurant <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <PhoneCard header="Restaurant Partner" step={active}>
            <RestaurantScene step={active} />
          </PhoneCard>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------- delivery ---------- */

function DeliveryScene({ step }) {
  if (step === 0) return <OtpScene title="Become a rider" />
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <motion.span
            className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <User className="w-7 h-7" style={{ color: BRAND }} />
          </motion.span>
          <p className="text-lg font-bold text-gray-900">Basic details</p>
        </div>
        <Field label="Full name" delay={0.2} width="65%" />
        <Field label="Vehicle number" delay={0.5} width="50%" />
        <Field label="Driving license number" delay={0.8} width="80%" />
      </div>
    )
  }
  if (step === 2) {
    const docs = [
      { label: "Profile photo", icon: Camera },
      { label: "Aadhar card", icon: IdCard },
      { label: "PAN card", icon: FileText },
      { label: "Driving license", icon: BadgeCheck },
    ]
    return (
      <div className="space-y-4">
        <p className="text-lg font-bold text-gray-900">Upload documents</p>
        <div className="grid grid-cols-2 gap-3">
          {docs.map(({ label, icon: Icon }, i) => (
            <motion.div
              key={label}
              className="relative rounded-2xl border-2 border-dashed border-gray-200 p-4 flex flex-col items-center gap-2 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, borderColor: ["#E5E7EB", "#22C55E"] }}
              transition={{ delay: i * 0.3, duration: 0.4, borderColor: { delay: 0.6 + i * 0.3 } }}
            >
              <Icon className="w-6 h-6 text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-700">{label}</span>
              <motion.span
                className="absolute -top-2 -right-2 bg-white rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 + i * 0.3, type: "spring", stiffness: 400, damping: 14 }}
              >
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
        <div>
          <p className="font-bold text-gray-900">Duty status</p>
          <motion.p
            className="text-xs font-semibold text-green-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            You're online
          </motion.p>
        </div>
        <motion.div
          className="w-14 h-8 rounded-full p-1 flex"
          initial={{ backgroundColor: "#D1D5DB" }}
          animate={{ backgroundColor: "#22C55E" }}
          transition={{ delay: 0.4 }}
        >
          <motion.span
            className="w-6 h-6 rounded-full bg-white shadow"
            initial={{ x: 0 }}
            animate={{ x: 24 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 500, damping: 30 }}
          />
        </motion.div>
      </div>
      <SuccessBadge title="Approved!" subtitle="Start delivering and earning." />
      <Toast icon={Bike} title="New delivery request" subtitle="Pickup 1.2 km away" delay={1} />
    </div>
  )
}

/** A rider driving along a road under the phone card. */
function RidingScooter() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="relative mt-6 h-16 max-w-[420px] mx-auto">
      <div className="absolute inset-x-0 bottom-3 h-1 rounded-full bg-white/10" />
      <div
        className="absolute inset-x-0 bottom-[13px] h-[2px] opacity-40"
        style={{ backgroundImage: "linear-gradient(90deg, #fff 50%, transparent 50%)", backgroundSize: "24px 2px" }}
      />
      {/* Full-width track moved with translateX (% of its own width = road width), so no layout work per frame */}
      <motion.div
        className="absolute inset-x-0 bottom-4 will-change-transform"
        initial={{ x: "-15%" }}
        animate={reduceMotion ? { x: "45%" } : { x: ["-15%", "100%"] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "linear" }}
      >
        <motion.span
          className="flex w-12 h-12 rounded-full bg-[#D32F2F] items-center justify-center shadow-lg shadow-[#D32F2F]/40"
          animate={reduceMotion ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          <Bike className="w-6 h-6 text-white" />
        </motion.span>
      </motion.div>
    </div>
  )
}

export function DeliveryOnboardingSection() {
  const ref = useRef(null)
  const [active, setActive, playing] = useStepCycle(DELIVERY_STEPS.length, ref)

  return (
    <section id="partner-delivery" ref={ref} className="pt-4 md:pt-6 pb-8 md:pb-10 px-6 bg-[#111] relative overflow-hidden">
      <div className="absolute top-1/2 -translate-y-1/2 -left-64 w-[720px] h-[720px] rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(211,47,47,0.12),transparent_60%)]" />
      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          className="order-2 lg:order-1"
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <PhoneCard header="Delivery Partner" step={active}>
            <DeliveryScene step={active} />
          </PhoneCard>
          <RidingScooter />
        </motion.div>

        <motion.div
          className="order-1 lg:order-2"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <div className="flex flex-wrap gap-3 mb-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D32F2F]/40 bg-[#D32F2F]/10 px-4 py-1.5 text-sm font-semibold text-[#FF6B6B]">
              <Bike className="w-4 h-4" /> Become a Delivery Partner
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-sm font-semibold text-yellow-300">
              <Zap className="w-4 h-4" /> Fast registration
            </span>
          </div>
          <h2 className="text-3xl md:text-[42px] font-black mb-3 leading-tight">
            Ride with Foodie, <span className="text-[#D32F2F]">earn on your time</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg mb-7 max-w-xl">
            Sign up from your phone, upload your documents and start delivering once you're approved.
          </p>

          <StepList steps={DELIVERY_STEPS} active={active} onSelect={setActive} playing={playing} />

          <button
            type="button"
            onClick={() => openAppStore("delivery")}
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#D32F2F] px-7 py-3.5 font-bold text-white shadow-lg shadow-[#D32F2F]/30 hover:bg-[#B71C1C] hover:-translate-y-0.5 transition-all"
          >
            Become a delivery partner <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </section>
  )
}

const DIAMOND_PATTERN =
  'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg stroke=\'%23D32F2F\' stroke-width=\'1\'%3E%3Cpath d=\'M30 0l30 30-30 30L0 30z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'

/**
 * Red diamond pattern on the `from` colour that ends in a convex curve filled with
 * the next section's colour (`to`), so one section flows into the next.
 * A thin red edge marks the curve when both colours are dark.
 */
export function PatternDivider({ from = "#111111", to = "#ffffff", edge = false }) {
  return (
    <div
      className="relative w-full h-[80px] md:h-[130px] overflow-hidden flex justify-center -mt-px"
      style={{ backgroundColor: from }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: DIAMOND_PATTERN, backgroundSize: "120px 120px" }}
      />
      <div className="absolute -bottom-0.5 left-0 w-full z-20">
        <svg viewBox="0 0 1440 200" className="w-full h-[50px] md:h-[90px] block" preserveAspectRatio="none">
          <path d="M0,200 L0,150 Q720,0 1440,150 L1440,200 Z" fill={to} />
          {edge && (
            <path
              d="M0,150 Q720,0 1440,150"
              fill="none"
              stroke="#D32F2F"
              strokeOpacity="0.6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
    </div>
  )
}
