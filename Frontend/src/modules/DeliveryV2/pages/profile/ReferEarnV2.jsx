import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Check, Copy, Link2, Share2 } from "lucide-react"
import { deliveryAPI } from "@food/api"
import { toast } from "sonner"
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
  credited: { label: "Reward added", className: "text-emerald-700" },
  pending_approval: { label: "Waiting for approval", className: "text-amber-700" },
  approved: { label: "Approved", className: "text-sky-700" },
  not_eligible: { label: "No reward", className: "text-gray-500" },
  application_rejected: { label: "Not approved", className: "text-rose-600" },
}

const STEPS = [
  { title: "Share your invite", text: "Send your link or code to friends who want to deliver." },
  { title: "Your friend signs up", text: "They register as a delivery partner with your code." },
  { title: "You get paid", text: "When their documents are approved, the reward is added to your pocket." },
]

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older WebViews without clipboard permission
    const el = document.createElement("textarea")
    el.value = text
    el.setAttribute("readonly", "")
    el.style.position = "fixed"
    el.style.opacity = "0"
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(el)
    return ok
  }
}

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

const Card = ({ children, className = "" }) => <section className={`bg-white rounded-2xl p-4 ${className}`}>{children}</section>

export const ReferEarnV2 = () => {
  const goBack = useDeliveryBackNavigation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState("")

  useEffect(() => {
    deliveryAPI
      .getReferralDetails()
      .then((res) => {
        const details = res?.data?.data || null
        if (details && details.visible === false) {
          // Admin turned Refer & Earn off in Customization Settings
          navigate("/food/delivery/profile", { replace: true })
          return
        }
        setData(details)
      })
      .catch(() => toast.error("Failed to load Refer & Earn"))
      .finally(() => setLoading(false))
  }, [navigate])

  const code = data?.code || ""
  const link = data?.shareLink || buildDeliveryReferralLink(code)
  const message =
    data?.shareMessage ||
    `Hey! I deliver with Foodie and earn on my own schedule.\nJoin as a delivery partner using my referral code ${code}.\n\nSign up here: ${link}`

  const handleCopy = async (what) => {
    const ok = await copyText(what === "code" ? code : link)
    if (!ok) return
    setCopied(what)
    toast.success(what === "code" ? "Code copied" : "Invite link copied")
    setTimeout(() => setCopied(""), 2000)
  }

  const handleShare = async () => {
    if (!code) return
    try {
      if (navigator.share) {
        // The message already contains the link; passing `url` too makes some apps show it twice.
        await navigator.share({ text: message })
        return
      }
    } catch (e) {
      if (e?.name === "AbortError") return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")
  }

  const ladderRows = data?.ladder?.rows || []
  const afterTiers = data?.ladder?.afterTiers
  const referralCount = data?.referralCount || 0
  const nextNumber = referralCount + 1
  const progress = data?.maxReferrals ? Math.min(100, (referralCount / data.maxReferrals) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-100 font-poppins pb-24 text-gray-900">
      <div className="bg-white px-4 py-5 flex items-center gap-3 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-full" aria-label="Back">
          <ArrowLeft className="w-6 h-6 text-gray-950" />
        </button>
        <h1 className="text-xl font-bold text-gray-950">Refer & Earn</h1>
      </div>

      <div className="pt-24 px-4 space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-64 rounded-2xl bg-gray-200" />
            <div className="h-24 rounded-2xl bg-gray-200" />
            <div className="h-40 rounded-2xl bg-gray-200" />
          </div>
        ) : !data ? (
          <Card className="text-center text-sm text-gray-500 py-8">Could not load Refer & Earn. Try again later.</Card>
        ) : (
          <>
            {/* Offer + code */}
            <Card className="p-5">
              {data.enabled ? (
                <>
                  <p className="text-sm text-gray-500">Invite friends to deliver with Foodie</p>
                  <h2 className="mt-1 text-[26px] font-bold leading-tight">Earn up to {formatINR(data.maxEarning)}</h2>
                  <p className="mt-1.5 text-sm text-gray-600">{describePlan(data)}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold leading-tight">Referral rewards are paused</h2>
                  <p className="mt-1.5 text-sm text-gray-600">You can still invite friends with your code.</p>
                </>
              )}

              <div className="mt-5 flex items-center justify-between rounded-xl border border-dashed border-[#0E4B9C]/40 bg-[#0E4B9C]/[0.04] px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">Your referral code</p>
                  <p className="text-lg font-bold tracking-wide">{code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy("code")}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold active:bg-blue-50"
                  style={{ color: BLUE }}
                >
                  {copied === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white active:opacity-90"
                style={{ backgroundColor: BLUE }}
              >
                <Share2 className="w-4 h-4" /> Invite friends
              </button>
              <button
                type="button"
                onClick={() => handleCopy("link")}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-50"
              >
                {copied === "link" ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {copied === "link" ? "Link copied" : "Copy invite link"}
              </button>
            </Card>

            {/* Progress */}
            <Card>
              <div className="flex items-baseline justify-between">
                <p className="text-[15px] font-semibold">
                  {referralCount}
                  {data.maxReferrals ? ` of ${data.maxReferrals}` : ""} referrals
                </p>
                <p className="text-sm text-gray-500">
                  Earned <span className="font-semibold text-emerald-700">{formatINR(data.totalReferralEarnings)}</span>
                </p>
              </div>
              {data.maxReferrals > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, backgroundColor: BLUE }} />
                </div>
              )}
              <p className="mt-3 text-sm text-gray-600">
                {data.enabled && data.remaining > 0 ? (
                  <>
                    Your {ordinal(nextNumber)} referral earns <span className="font-semibold text-gray-900">{formatINR(data.nextReward)}</span>
                  </>
                ) : data.enabled ? (
                  "You have used all your referrals."
                ) : (
                  "Rewards will show here when referrals are back on."
                )}
              </p>
              {data.pendingCount > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  {data.pendingCount} {data.pendingCount === 1 ? "friend is" : "friends are"} waiting for approval
                </p>
              )}
            </Card>

            {/* Reward per referral */}
            {data.enabled && (ladderRows.length > 0 || afterTiers) && (
              <Card>
                <h3 className="text-[15px] font-semibold mb-1">Reward for each referral</h3>
                <div className="divide-y divide-gray-100">
                  {ladderRows.map((row) => {
                    const done = row.referralNumber <= referralCount
                    const isNext = row.referralNumber === nextNumber
                    return (
                      <div key={row.referralNumber} className="flex items-center justify-between py-3 text-sm">
                        <span className={`flex items-center gap-2 ${done ? "text-gray-400" : "text-gray-700"}`}>
                          {ordinal(row.referralNumber)} referral
                          {done && <Check className="w-4 h-4 text-emerald-600" />}
                          {isNext && (
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: BLUE, backgroundColor: "rgba(14,75,156,0.08)" }}>
                              Next
                            </span>
                          )}
                        </span>
                        <span className={`font-semibold ${done ? "text-gray-400" : "text-gray-900"}`}>{formatINR(row.amount)}</span>
                      </div>
                    )
                  })}
                  {afterTiers && (
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span className="flex items-center gap-2 text-gray-700">
                        {afterTiers.fromReferral === afterTiers.toReferral
                          ? `${ordinal(afterTiers.fromReferral)} referral`
                          : `${ordinal(afterTiers.fromReferral)} to ${ordinal(afterTiers.toReferral)} referral`}
                        {nextNumber >= afterTiers.fromReferral && nextNumber <= afterTiers.toReferral && (
                          <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: BLUE, backgroundColor: "rgba(14,75,156,0.08)" }}>
                            Next
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatINR(afterTiers.amount)}
                        {afterTiers.fromReferral !== afterTiers.toReferral ? " each" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* How it works */}
            <Card>
              <h3 className="text-[15px] font-semibold mb-3">How it works</h3>
              <ol className="space-y-4">
                {STEPS.map(({ title, text }, idx) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-semibold text-gray-700">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-[13px] text-gray-500 leading-relaxed">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Invited partners */}
            <Card>
              <h3 className="text-[15px] font-semibold">
                Your referrals{data.invited?.length ? ` (${data.invited.length})` : ""}
              </h3>
              {!data.invited?.length ? (
                <p className="py-4 text-sm text-gray-500">No one has joined with your code yet.</p>
              ) : (
                <div className="mt-1 divide-y divide-gray-100">
                  {data.invited.map((item) => {
                    const status = STATUS[item.status] || STATUS.pending_approval
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.phone}
                            {item.joinedAt
                              ? ` · Joined ${new Date(item.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {item.status === "credited" && (
                            <p className="text-sm font-semibold text-emerald-700">+{formatINR(item.rewardAmount)}</p>
                          )}
                          <p className={`text-xs font-medium ${status.className}`}>{status.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <p className="px-1 pt-1 text-xs leading-relaxed text-gray-500">
              A referral counts once your friend signs up with your code and is approved. Each person can be referred only
              once. Rewards go to your pocket balance.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ReferEarnV2
