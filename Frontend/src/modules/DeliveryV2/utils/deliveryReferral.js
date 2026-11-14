// Keeps the referral code from an invite link (/join/CODE or ?ref=CODE) until the partner finishes signup.
// Survives the login → OTP → details → documents flow and app reloads.
const STORAGE_KEY = "delivery_referral_code"

const sanitize = (value) =>
  String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 64)

export const storeDeliveryReferral = (code) => {
  const ref = sanitize(code)
  try {
    if (ref) localStorage.setItem(STORAGE_KEY, ref)
  } catch {
    // storage unavailable (private mode): the partner can still type the code
  }
  return ref
}

export const captureDeliveryReferralFromSearch = (search) => {
  try {
    return storeDeliveryReferral(new URLSearchParams(search || "").get("ref"))
  } catch {
    return ""
  }
}

export const getStoredDeliveryReferral = () => {
  try {
    return sanitize(localStorage.getItem(STORAGE_KEY))
  } catch {
    return ""
  }
}

export const clearStoredDeliveryReferral = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const normalizeDeliveryReferralInput = (value) => sanitize(value).toUpperCase()

/** Fallback when the server did not send a share link: short invite page on this site. */
export const buildDeliveryReferralLink = (code) =>
  code ? `${window.location.origin}/join/${encodeURIComponent(code)}` : ""
