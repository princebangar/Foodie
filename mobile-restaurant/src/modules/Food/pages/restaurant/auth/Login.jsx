// Restaurant partner login: same look as the customer app login (admin images slider + white sheet, then the white
// "OTP Verification" page; modules/auth/components/PartnerLogin.jsx). Both /food/restaurant/login and
// /food/restaurant/otp render this screen; the step is read from the path. The API calls, session keys and navigation
// are the restaurant ones (web: modules/Food/pages/restaurant/auth/Login.jsx).
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Keyboard, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { Phone, X } from "lucide-react-native"
import { useNavigate, useLocation, router } from "@/lib/router"
import { toast } from "@/lib/toast"
import { Dialog, Text } from "@/native/ui"
import { LoginExitGuard } from "@/native/ui/LoginExitGuard"
import { alpha, colors, restaurantTheme, shadow } from "@/theme"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
  setPendingTicket,
  clearPendingTicket,
  setPendingPartnerType,
} from "@food/utils/auth"
import { clearOnboardingFromLocalStorage, clearAllFilesFromDB, checkOnboardingStatus, isRestaurantOnboardingComplete } from "@/modules/Food/utils/onboardingUtils"
import { collectFcmTokenFast, persistModuleFcmToken } from "@food/utils/firebaseMessaging"
import { prefetchPolicyContentWhenIdle } from "@/shared/utils/policyPages"
import { hardNavigate } from "@/shared/utils/nativeShell"
import { requestPhoneFocus, usePhoneFocusRequest } from "@/shared/utils/loginFocus"
import { LoginNumberScreen, LoginOtpScreen } from "@/modules/auth/components/PartnerLogin"

const DEFAULT_COUNTRY_CODE = "+91"
// the app theme colour on the login (Continue button, OTP links, banner backdrop)
const ACCENT = restaurantTheme.brand // #B80B3D
const ACCENT_PRESSED = "#8A0A2E"

// The onboarding screen keeps picked photos under this sessionStorage prefix (the web's IndexedDB
// "RestaurantOnboardingFiles", which clearAllFilesFromDB deletes on the web): cleared together here.
const ONBOARDING_FILE_STORE_PREFIX = "RestaurantOnboardingFiles:"
const clearOnboardingFileStore = () => {
  try {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(ONBOARDING_FILE_STORE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const isOtpStep = location.pathname.endsWith("/otp")
  // Cleanup onboarding on initial mount only
  useEffect(() => {
    clearOnboardingFromLocalStorage()
    clearAllFilesFromDB()
    clearOnboardingFileStore()
  }, [])

  // Terms / Privacy / Support load in the background so tapping one opens it straight away.
  useEffect(() => prefetchPolicyContentWhenIdle("restaurant"), [])

  // Close the keyboard when the screen goes away
  useEffect(() => () => Keyboard.dismiss(), [])

  // Step 1 States
  const phoneInputRef = useRef(null)
  // The login screen stays mounted under the code screen: the pencil's "focus the number box" note is read each time
  // the login screen is shown again (web: the page mounted again).
  const [screenFocused, setScreenFocused] = useState(false)
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true)
      return () => setScreenFocused(false)
    }, []),
  )
  // cursor into the number box only when coming back with the pencil (not after a logout / plain visit)
  usePhoneFocusRequest(() => phoneInputRef.current, !isOtpStep && screenFocused)

  // Never prefill a number (the old dev "default test phone" leaked into
  // builds). Only what the restaurant typed is kept — saved on every change so
  // a trip to Terms / Privacy / Support and back doesn't wipe it.
  const [phone, setPhoneState] = useState(() => {
    try {
      if (sessionStorage.getItem("restaurantClearLoginPhone") === "1") {
        sessionStorage.removeItem("restaurantClearLoginPhone")
        sessionStorage.removeItem("restaurantLoginPhone")
        return ""
      }
      return sessionStorage.getItem("restaurantLoginPhone") || ""
    } catch {
      return ""
    }
  })
  const setPhone = (value) => {
    setPhoneState(value)
    try {
      if (value) sessionStorage.setItem("restaurantLoginPhone", value)
      else sessionStorage.removeItem("restaurantLoginPhone")
    } catch {
      // ignore
    }
  }
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)
  // Foodie is restaurant-only (no "My Store"): the partner is always a restaurant partner.
  const partnerType = "restaurant"
  // The number already has an account for the OTHER role: ask before creating a second one.

  // Step 2 States
  const [otp, setOtpState] = useState(["", "", "", ""])
  // Latest boxes for the key / change handlers (two quick key presses must not read a stale array).
  const otpRef = useRef(["", "", "", ""])
  const setOtp = (next) => {
    otpRef.current = next
    setOtpState(next)
  }
  const [otpError, setOtpError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [blockTimer, setBlockTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [, setDeletedAccountData] = useState(null)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const isSuccessRef = useRef(false)

  const getBlockKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `restaurant_block_expires_at_${clean}` : "restaurant_block_expires_at"
  }

  const getResendKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `restaurant_resend_expires_at_${clean}` : "restaurant_resend_expires_at"
  }

  // Web: navigate("/food/restaurant/login"). The login screen is the one under this code screen in the native stack,
  // so going back to it returns there (a push would leave a second login screen in the stack).
  const goToLoginScreen = () => {
    Keyboard.dismiss()
    if (isOtpStep && router.canGoBack()) navigate(-1)
    else navigate("/food/restaurant/login", { replace: true })
  }

  // Handle route changes between /login and /otp
  useEffect(() => {
    if (!isOtpStep) {
      setOtp(["", "", "", ""])
      setOtpError("")
      return
    }

    const stored = sessionStorage.getItem("restaurantAuthData")
    let currentPhone = ""
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
        currentPhone = data.email
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        let formatted = ""
        if (phoneMatch) {
          formatted = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
        } else {
          formatted = data.phone || ""
        }
        setContactInfo(formatted)
        currentPhone = formatted
      }
    } else {
      navigate("/food/restaurant/login", { replace: true })
      return
    }

    const blockKey = getBlockKey(currentPhone)
    const resendKey = getResendKey(currentPhone)

    // Resume block timer
    const savedBlockExpiry = sessionStorage.getItem(blockKey)
    if (savedBlockExpiry) {
      const remaining = Math.max(0, Math.floor((parseInt(savedBlockExpiry) - Date.now()) / 1000))
      if (remaining > 0) {
        setBlockTimer(remaining)
      } else {
        sessionStorage.removeItem(blockKey)
      }
    } else if (location.state?.initialBlockMins) {
      const seconds = Math.ceil(location.state.initialBlockMins * 60)
      setBlockTimer(seconds)
      sessionStorage.setItem(blockKey, (Date.now() + (seconds * 1000)).toString())
    }

    // Resume resend timer
    const savedResendExpiry = sessionStorage.getItem(resendKey)
    if (savedResendExpiry) {
      const remaining = Math.max(0, Math.floor((parseInt(savedResendExpiry) - Date.now()) / 1000))
      if (remaining > 0) {
        setResendTimer(remaining)
      } else {
        sessionStorage.removeItem(resendKey)
      }
    } else {
      setResendTimer(59)
      sessionStorage.setItem(resendKey, (Date.now() + (59 * 1000)).toString())
    }
     
  }, [isOtpStep, navigate, location.state])

  // OTP Timers
  useEffect(() => {
    if (resendTimer <= 0) return undefined
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return undefined
    const timer = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [blockTimer])

  // Put the cursor in a box and open the keyboard (blur first: Android treats it as a new focus and shows the keyboard
  // even right after the phone screen's keyboard closed).
  const focusOtpBox = (index, delay = 0) => {
    setTimeout(() => {
      const el = inputRefs.current[index]
      el?.blur()
      el?.focus()
    }, delay)
  }

  // Autofocus first OTP box + open the keyboard automatically
  useEffect(() => {
    if (!isOtpStep) return undefined
    const timer = setTimeout(() => {
      const el = inputRefs.current[0]
      el?.blur()
      el?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [isOtpStep])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    if (digits.length !== 10) return false
    return ["6", "7", "8", "9"].includes(digits[0])
  }

  // Action Step 1: Send OTP
  const handleSendOTP = async (e, confirmNewRole = false) => {
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      const sendRes = await restaurantAPI.sendOTP(fullPhone, "login", null, partnerType, confirmNewRole)
      const nextAuthData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
        partnerType,
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(nextAuthData))
      sessionStorage.setItem("restaurantLoginPhone", phone)

      // Web: navigate to /otp (both routes render this screen)
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      const msg = apiErr?.response?.data?.error || apiErr?.response?.data?.message || apiErr?.message || "Failed to send OTP."
      const lowerMsg = msg.toLowerCase()
      const isBlocked = lowerMsg.includes("blocked") ||
                        lowerMsg.includes("too many attempts") ||
                        lowerMsg.includes("try again after")

      if (isBlocked) {
        let totalMins = 3
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          const mins = parseInt(timeMatch[1])
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) / 60 : 0
          totalMins = mins + secs
        }

        const nextAuthData = {
          method: "phone",
          phone: fullPhone,
          isSignUp: false,
          module: "restaurant",
          partnerType,
        }
        sessionStorage.setItem("restaurantAuthData", JSON.stringify(nextAuthData))
        sessionStorage.setItem("restaurantLoginPhone", phone)
        navigate("/food/restaurant/otp", { state: { initialBlockMins: totalMins } })
        return
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  // Action Step 2: Verify OTP
  const handleVerify = async (otpValue = null, confirmAction = null) => {
    const code = otpValue || otpRef.current.join("")

    if (code.length !== 4) {
      toast.error("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

    if (isSuccessRef.current || loading || blockTimer > 0) return
    if (!confirmAction && hasSubmittedRef.current) return

    setLoading(true)
    if (!confirmAction) hasSubmittedRef.current = true

    try {
      if (!authData) throw new Error("Session expired. Please login again.")

      const phoneVal = authData.phone
      const purpose = authData.isSignUp ? "register" : "login"
      const verifyPartnerType = "restaurant"

      const { fcmToken, platform } = await collectFcmTokenFast("restaurant")

      const response = await restaurantAPI.verifyOTP(
        phoneVal,
        code,
        purpose,
        null,
        authData.email,
        fcmToken,
        platform,
        confirmAction,
        verifyPartnerType,
      )
      const data = response?.data?.data || response?.data

      // Lets the "under review" screen log in by itself once admin approves.
      if (data?.pendingToken || data?.pendingTicket) setPendingTicket("restaurant", data.pendingToken || data.pendingTicket)
      else if (data?.accessToken) clearPendingTicket("restaurant")

      if (data.deletedAccountFound) {
        Keyboard.dismiss()
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
      } else if (data.pendingApproval === true) {
        isSuccessRef.current = true
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setRestaurantPendingPhone(phoneVal)
        const isRejected = Boolean(data.isRejected)
        setPendingPartnerType(verifyPartnerType)
        const statusVal = isRejected ? "rejected" : "pending"
        localStorage.setItem("restaurant_pendingStatus", statusVal)
        localStorage.setItem("restaurant_pendingMessage", data.message || "")
        setShowRestorePopup(false)
        setLoading(false)
        Keyboard.dismiss()
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: {
            phone: phoneVal || "",
            isRejected,
            isDisabled: false,
            message: data.message,
          },
        })
      } else if (data.needsRegistration === true) {
        isSuccessRef.current = true
        setRestaurantPendingPhone(phoneVal)
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setShowRestorePopup(false)
        Keyboard.dismiss()
        hardNavigate("/food/restaurant/onboarding")
      } else {
        isSuccessRef.current = true
        const accessToken = data.accessToken
        const restaurant = data.restaurant || data.user
        const status = String(restaurant?.status || "").toLowerCase()

        if (status && status !== "approved") {
          setPendingPartnerType()
          sessionStorage.removeItem("restaurantAuthData")
          sessionStorage.removeItem("restaurantLoginPhone")
          sessionStorage.removeItem(getBlockKey(phoneVal))
          sessionStorage.removeItem(getResendKey(phoneVal))
          setRestaurantPendingPhone(phoneVal)
          const isRejected = status === "rejected"
          const isDisabled = status === "banned" || status === "deleted"
          const statusVal = isDisabled ? "banned" : (isRejected ? "rejected" : "pending")
          localStorage.setItem("restaurant_pendingStatus", statusVal)
          localStorage.setItem(
            "restaurant_pendingMessage",
            isRejected
              ? (restaurant?.rejectionReason
                  ? `Your restaurant registration has been rejected. Reason: ${restaurant.rejectionReason}`
                  : "Your restaurant registration has been rejected. Please contact support.")
              : "Your restaurant registration is pending approval.",
          )
          setShowRestorePopup(false)
          setLoading(false)
          Keyboard.dismiss()
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: {
              phone: phoneVal || "",
              isRejected,
              isDisabled,
            },
          })
          return
        }

        setRestaurantAuthData("restaurant", accessToken, restaurant, data?.refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        try {
          await persistModuleFcmToken("restaurant", { fcmToken, platform })
        } catch {
          // ignore
        }
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setShowRestorePopup(false)
        Keyboard.dismiss()

        if (authData?.isSignUp) {
          hardNavigate("/food/restaurant/onboarding")
        } else {
          const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
          if (!onboardingComplete) {
            const incompleteStep = await checkOnboardingStatus()
            if (incompleteStep) {
              hardNavigate(`/food/restaurant/onboarding?step=${incompleteStep}`)
              return
            }
          }
          hardNavigate("/food/restaurant")
        }
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.response?.data?.message || "Invalid OTP. Please try again."
      setOtp(["", "", "", ""])

      const isBlocked = message.toLowerCase().includes("blocked") ||
                        message.toLowerCase().includes("too many attempts") ||
                        message.toLowerCase().includes("try again after")

      if (isBlocked) {
        let totalSeconds = 180
        const timeMatch = message.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          const mins = parseInt(timeMatch[1])
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0
          totalSeconds = (mins * 60) + secs
        }
        setBlockTimer(totalSeconds)
        sessionStorage.setItem(getBlockKey(authData?.phone || ""), (Date.now() + (totalSeconds * 1000)).toString())
      } else {
        if (/pending approval|rejected|disabled|banned/i.test(message)) {
          const pendingPhone = authData?.phone || authData?.email || contactInfo
          setRestaurantPendingPhone(pendingPhone)

          const isRejected = /rejected/i.test(message)
          const isDisabled = /disabled|banned/i.test(message)
          const statusVal = isDisabled ? "banned" : (isRejected ? "rejected" : "pending")

          localStorage.setItem("restaurant_pendingStatus", statusVal)
          localStorage.setItem("restaurant_pendingMessage", message)

          Keyboard.dismiss()
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: {
              phone: pendingPhone || "",
              isRejected: isRejected,
              isDisabled: isDisabled,
              message: message,
            },
          })
          return
        }

        if (/invalid/i.test(message)) {
          setOtpError("Invalid OTP")
        } else {
          toast.error(message)
        }
      }
      hasSubmittedRef.current = false
      setLoading(false)
      // wrong code: boxes emptied, cursor back in the first box with the keyboard open
      focusOtpBox(0, 150)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || blockTimer > 0) return
    setLoading(true)
    try {
      const purpose = authData.isSignUp ? "register" : "login"
      await restaurantAPI.sendOTP(authData.phone, purpose, authData.email, authData.partnerType)
      setResendTimer(59)
      sessionStorage.setItem(getResendKey(authData.phone), (Date.now() + (59 * 1000)).toString())
      // Clear the old code from the boxes — only the new one should be entered.
      setOtp(["", "", "", ""])
      setOtpError("")
      hasSubmittedRef.current = false
      focusOtpBox(0, 50)
      toast.success("OTP resent successfully.", { duration: 3000 })
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code")
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreAction = async (action) => {
    const code = otpRef.current.join("")
    await handleVerify(code, action)
  }

  const afterOtpUpdate = (newOtp, nextIndex) => {
    if (newOtp.every((digit) => digit !== "")) {
      // last digit in: verify straight away (customer login)
      handleVerify(newOtp.join(""))
    } else if (nextIndex != null) {
      inputRefs.current[nextIndex]?.focus()
    }
  }

  const handleChange = (index, rawValue) => {
    let value = String(rawValue ?? "")
    if (index === 0 && value) {
      setOtpError("")
    }

    const current = otpRef.current
    // a box keeps its digit selected on focus; typing over it on a keyboard that does not replace the selection gives
    // "old+new": keep the new digit only
    if (value.length === 2 && current[index] && value.startsWith(current[index])) {
      value = value.slice(1)
    }

    if (value.length > 1) {
      // pasted / auto-filled code (web: onPaste + multi-char change)
      const digits = value.replace(/\D/g, "").slice(0, 4 - index).split("")
      if (digits.length > 0) {
        const newOtp = [...current]
        digits.forEach((digit, i) => {
          if (index + i < 4) {
            newOtp[index + i] = digit
          }
        })
        setOtp(newOtp)
        afterOtpUpdate(newOtp, Math.min(3, index + digits.length))
      }
      return
    }

    if (value && !/^\d$/.test(value)) return

    const newOtp = [...current]
    newOtp[index] = value
    setOtp(newOtp)

    if (value) afterOtpUpdate(newOtp, index < 3 ? index + 1 : null)
  }

  const handleKeyDown = (index, e) => {
    if (e?.nativeEvent?.key === "Backspace") {
      const current = otpRef.current
      if (!current[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...current]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
  }

  const showLoginStep = !isOtpStep

  const closeRestorePopup = () => {
    setShowRestorePopup(false)
    goToLoginScreen()
  }

  const otpPhoneLabel = `+91-${String(authData?.phone || contactInfo || phone).replace(/\D/g, "").slice(-10)}`

  return (
    <View style={styles.root}>
      <LoginExitGuard enabled={showLoginStep} dirty={phone.length > 0} accent={ACCENT} />

      {showLoginStep ? (
        <LoginNumberScreen
          appType="restaurant"
          phone={phone}
          onPhoneChange={setPhone}
          phoneInputRef={phoneInputRef}
          onContinue={() => handleSendOTP()}
          loading={loading}
          accent={ACCENT}
          accentPressed={ACCENT_PRESSED}
          legalFrom="/food/restaurant/login"
          legalLinks={[
            { to: "/food/restaurant/terms", label: "Terms of Service" },
            { to: "/food/restaurant/privacy", label: "Privacy Policy" },
            { to: "/food/restaurant/help-content", label: "Support" },
          ]}
        />
      ) : (
        <LoginOtpScreen
          phoneLabel={otpPhoneLabel}
          otp={otp}
          inputRefs={inputRefs}
          onOtpChange={handleChange}
          onOtpKeyPress={handleKeyDown}
          loading={loading}
          otpError={otpError}
          blockTimer={blockTimer}
          resendTimer={resendTimer}
          onResend={handleResend}
          accent={ACCENT}
          onBack={() => {
            requestPhoneFocus()
            goToLoginScreen()
          }}
        />
      )}

      {/* Restore/New Account Popup */}
      <Dialog open={showRestorePopup} onClose={closeRestorePopup} backdropOpacity={0.6} style={styles.restoreCard}>
        <Pressable
          onPress={closeRestorePopup}
          accessibilityLabel="Close and return to login"
          style={({ pressed }) => [styles.restoreClose, pressed && { transform: [{ scale: 0.95 }], backgroundColor: colors.gray[100] }]}
        >
          <X size={20} color={colors.gray[400]} />
        </Pressable>

        <View style={styles.restoreIcon}>
          <Phone size={40} color="#DC2626" />
        </View>

        <Text style={styles.restoreTitle}>Restaurant Found!</Text>
        <Text style={styles.restoreText}>
          {"A deleted restaurant for "}
          <Text style={{ fontWeight: "700", color: colors.gray[900] }}>{contactInfo}</Text>
          {" was found. Do you want to restore your old data or start fresh with a new account?"}
        </Text>

        <View style={{ gap: 16 }}>
          <Pressable
            onPress={() => handleRestoreAction("restore")}
            style={({ pressed }) => [styles.restoreBtn, pressed && { backgroundColor: "#B91C1C" }]}
          >
            <Text style={styles.restoreBtnText}>Restore My Account</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRestoreAction("new")}
            style={({ pressed }) => [styles.newAccountBtn, pressed && { backgroundColor: colors.gray[50] }]}
          >
            <Text style={styles.newAccountText}>Create New Account</Text>
          </Pressable>
        </View>
      </Dialog>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", overflow: "hidden" },
  restoreCard: { maxWidth: 384, borderRadius: 24, padding: 32, alignItems: "stretch", borderWidth: 1, borderColor: colors.gray[100], backgroundColor: colors.white, ...shadow["2xl"] },
  restoreClose: { position: "absolute", top: 16, right: 16, padding: 8, borderRadius: 12, zIndex: 2 },
  restoreIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: alpha("#DC2626", 0.1), alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24 },
  restoreTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.gray[900], marginBottom: 12, textAlign: "center" },
  restoreText: { fontSize: 16, lineHeight: 26, color: colors.gray[500], marginBottom: 32, textAlign: "center" },
  restoreBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#DC2626" },
  restoreBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
  newAccountBtn: { height: 56, borderWidth: 2, borderColor: colors.gray[200], borderRadius: 16, alignItems: "center", justifyContent: "center" },
  newAccountText: { fontSize: 16, fontWeight: "700", color: colors.gray[700] },
})
