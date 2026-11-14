import { useEffect, useState } from "react"
import apiClient from "@food/api/axios"

/**
 * Admin > Customization Settings > "Delivery Refer & Earn".
 * Returns null while loading, then true/false. Defaults to true if the request fails.
 */
export default function useDeliveryReferEarnVisible() {
  const [visible, setVisible] = useState(null)

  useEffect(() => {
    let alive = true
    apiClient
      .get("/food/public/customization-settings")
      .then((res) => alive && setVisible(res?.data?.data?.delivery_refer_earn_enabled !== false))
      .catch(() => alive && setVisible(true))
    return () => {
      alive = false
    }
  }, [])

  return visible
}
