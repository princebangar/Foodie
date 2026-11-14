import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { getAppName, getStoreLink } from "./appLinks"

/**
 * Target of the landing page QR code (/get-app, optionally ?app=restaurant|delivery).
 * Sends the visitor to the App Store on iPhone/iPad and the Play Store elsewhere,
 * or shows "coming soon" while the store links in appLinks.js are still empty.
 */
export default function GetAppPage() {
  const [params] = useSearchParams()
  const app = params.get("app") || "user"
  const [url] = useState(() => getStoreLink(app))

  useEffect(() => {
    if (url) window.location.replace(url)
  }, [url])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 bg-[#0B0B0B] text-white text-center">
      <img src="/logo.webp" alt="Foodie" className="h-16 w-auto rounded-2xl" />
      {url ? (
        <p className="text-gray-300">Opening the store…</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold mb-2">{getAppName(app)} is coming soon</h1>
            <p className="text-gray-400 max-w-sm">
              It will be available on the Play Store and App Store shortly. Scan this code again once it's live.
            </p>
          </div>
          <a href="/" className="rounded-xl bg-[#D32F2F] px-6 py-3 font-semibold hover:bg-[#B71C1C] transition-colors">
            Visit Foodie
          </a>
        </>
      )}
    </div>
  )
}
