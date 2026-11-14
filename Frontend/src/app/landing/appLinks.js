import { toast } from "sonner"

/**
 * Store links for the Foodie apps.
 *
 * Leave a link empty ("") while that app is not published yet: anything that
 * points at it (landing page buttons, footer "Apps For You", the QR code's
 * /get-app page) then shows "coming soon" instead of opening a store.
 *
 * When the apps are live, paste the links here. Nothing else needs to change:
 * iPhone / iPad visitors (Safari or Chrome) go to `ios`, everyone else to `android`.
 */
export const APP_LINKS = {
  user: { android: "", ios: "" },
  restaurant: { android: "", ios: "" },
  delivery: { android: "", ios: "" },
}

const APP_NAMES = {
  user: "Foodie app",
  restaurant: "Foodie Restaurant Partner app",
  delivery: "Foodie Delivery Partner app",
}

/** True on iPhone, iPod and iPad (iPadOS reports itself as a Mac with touch). */
export function isAppleMobile() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
}

/** The store link for this device, or "" if that app isn't published yet. */
export function getStoreLink(app = "user") {
  const links = APP_LINKS[app] || APP_LINKS.user
  return (isAppleMobile() ? links.ios : links.android) || ""
}

export function getAppName(app = "user") {
  return APP_NAMES[app] || APP_NAMES.user
}

/** Opens the right store for this device, or says the app is coming soon. */
export function openAppStore(app = "user") {
  const url = getStoreLink(app)
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  toast(`${getAppName(app)} is coming soon`, {
    description: "It will be available on the Play Store and App Store shortly.",
  })
}
