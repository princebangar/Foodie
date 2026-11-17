import { userAPI } from "@food/api"

// Last Diamond data per user, so the profile strip and Diamond page draw instantly
// (also after an app restart) while a fresh copy loads in the background.
const KEY = "foodie_diamond_v1"
let memory = null
let inFlight = null

const currentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user_user") || "null")
    return String(user?._id || user?.id || "")
  } catch {
    return ""
  }
}

export function getCachedDiamond() {
  const uid = currentUserId()
  if (memory && memory.uid === uid) return memory.data
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null")
    if (stored && stored.uid === uid && stored.data) {
      memory = stored
      return stored.data
    }
  } catch {
    // ignore broken cache
  }
  return null
}

export function setCachedDiamond(data) {
  if (!data) return
  memory = { uid: currentUserId(), data }
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // storage full: memory copy still helps this session
  }
}

/** One request at a time; resolves to fresh data (and updates the cache). */
export function fetchDiamond() {
  if (!inFlight) {
    inFlight = userAPI
      .getDiamond()
      .then((res) => {
        const data = res?.data?.data || null
        setCachedDiamond(data)
        return data
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/** Warm the Diamond page code so the first tap opens without waiting for the chunk. */
export const preloadDiamondPage = () => import("@food/pages/user/diamond/DiamondPage")
