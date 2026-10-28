import { useEffect, useState } from "react"

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * True only for the browser dashboard on laptop / tablet-landscape / desktop screens.
 * Every phone / small-tablet screen keeps the mobile UI untouched. (Foodie's partner
 * mobile app is a separate native app, so there is no WebView shell to detect here.)
 */
export default function useDesktopLayout() {
  const read = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_QUERY).matches

  const [isDesktop, setIsDesktop] = useState(read)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setIsDesktop(read())
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return isDesktop
}
