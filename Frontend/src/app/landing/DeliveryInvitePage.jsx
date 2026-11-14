import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, Copy } from "lucide-react"
import { deliveryAPI } from "@food/api"
import { getStoreLink } from "./appLinks"
import { storeDeliveryReferral } from "../../modules/DeliveryV2/utils/deliveryReferral"

const POINTS = [
  { title: "Choose your hours", text: "Go online whenever it suits you." },
  { title: "Earn on every trip", text: "See what you make for each delivery." },
  { title: "Withdraw to your bank", text: "Move your earnings out from the app." },
]

/** Adds the code as the Play Store install referrer so the app can read it after install. */
const withInstallReferrer = (storeUrl, code) => {
  if (!storeUrl || !/play\.google\.com/i.test(storeUrl)) return storeUrl
  const sep = storeUrl.includes("?") ? "&" : "?"
  return `${storeUrl}${sep}referrer=${encodeURIComponent(`ref=${code}`)}`
}

/**
 * Invite link a delivery partner shares: /join/DP-XXXXXXXX.
 * Saves the code so signup fills it in, then offers the app (once published) or web signup.
 */
export default function DeliveryInvitePage() {
  const { code: rawCode = "" } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    deliveryAPI
      .getReferralInvite(rawCode)
      .then((res) => {
        const data = res?.data?.data
        if (!alive) return
        if (data?.valid) storeDeliveryReferral(data.code)
        setInvite(data || { valid: false })
      })
      .catch(() => alive && setInvite({ valid: false }))
    return () => {
      alive = false
    }
  }, [rawCode])

  const loading = invite === null
  const code = invite?.valid ? invite.code : ""
  const storeUrl = withInstallReferrer(getStoreLink("delivery"), code)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked; the code is visible to copy by hand
    }
  }

  const heading = invite?.referrerName
    ? `${invite.referrerName} invited you to deliver with Foodie`
    : "Deliver with Foodie"

  return (
    <div className="min-h-screen bg-gray-50 font-poppins text-gray-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-8">
        <img src="/logo.webp" alt="Foodie" className="h-11 w-auto self-start rounded-xl" />

        {loading ? (
          <div className="mt-10 space-y-4 animate-pulse">
            <div className="h-8 w-4/5 rounded bg-gray-200" />
            <div className="h-4 w-3/5 rounded bg-gray-200" />
            <div className="h-24 rounded-2xl bg-gray-200" />
          </div>
        ) : (
          <>
            <h1 className="mt-10 text-[28px] font-bold leading-tight">{heading}</h1>
            <p className="mt-2 text-[15px] text-gray-600">
              {invite?.valid
                ? "Sign up as a delivery partner and start earning with your own bike or scooter."
                : "This invite link is not valid anymore, but you can still sign up as a delivery partner."}
            </p>

            {code && (
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-dashed border-[#0E4B9C]/40 bg-white px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">Referral code</p>
                  <p className="text-lg font-bold tracking-wide">{code}</p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#0E4B9C] active:bg-blue-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <ul className="mt-8 space-y-5">
              {POINTS.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0E4B9C] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold">{point.title}</p>
                    <p className="text-sm text-gray-500">{point.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-3 pt-10">
              {storeUrl && (
                <a
                  href={storeUrl}
                  className="block w-full rounded-xl bg-[#0E4B9C] py-3.5 text-center text-[15px] font-semibold text-white active:bg-[#0B3D80]"
                >
                  Download the app
                </a>
              )}
              <button
                type="button"
                onClick={() => navigate("/food/delivery/login")}
                className={
                  storeUrl
                    ? "w-full rounded-xl border border-gray-300 bg-white py-3.5 text-[15px] font-semibold text-gray-800 active:bg-gray-50"
                    : "w-full rounded-xl bg-[#0E4B9C] py-3.5 text-[15px] font-semibold text-white active:bg-[#0B3D80]"
                }
              >
                {storeUrl ? "Sign up on the web" : "Sign up now"}
              </button>
              {code && (
                <p className="text-center text-xs text-gray-500">Your referral code is added at signup automatically.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
