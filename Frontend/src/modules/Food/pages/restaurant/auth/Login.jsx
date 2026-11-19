import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { clearOnboardingFromLocalStorage, clearAllFilesFromDB, checkOnboardingStatus, isRestaurantOnboardingComplete } from "@/modules/Food/utils/onboardingUtils"
import { collectFcmTokenFast, persistModuleFcmToken } from "@food/utils/firebaseMessaging"
import { LoginNumberScreen, LoginOtpScreen } from "@/modules/auth/components/PartnerLogin"

// Same look as the Restaurant app login (admin images slider + white sheet, then the white "OTP Verification" page).
const ACCENT = "#B80B3D"
const ACCENT_PRESSED = "#8A0A2E"
const LOGIN_FONT = "'Poppins', sans-serif"

const DEFAULT_COUNTRY_CODE = "+91"

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const isOtpStep = location.pathname.endsWith("/otp")

  // Cleanup onboarding on initial mount only
  useEffect(() => {
    clearOnboardingFromLocalStorage()
    clearAllFilesFromDB()
  }, [])

  // Step 1 States
  const phoneInputRef = useRef(null)
  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : ""

  const [phone, setPhone] = useState(() => {
    try {
      if (sessionStorage.getItem("restaurantClearLoginPhone") === "1") {
        sessionStorage.removeItem("restaurantClearLoginPhone")
        sessionStorage.removeItem("restaurantLoginPhone")
        // return ""
        return defaultTestPhone
      }
      // return sessionStorage.getItem("restaurantLoginPhone") || ""
      return sessionStorage.getItem("restaurantLoginPhone") || defaultTestPhone
    } catch {
      // return ""
      return defaultTestPhone
    }
  })
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // Step 2 States
  const [otp, setOtp] = useState(["", "", "", ""])
  const [otpError, setOtpError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [blockTimer, setBlockTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [deletedAccountData, setDeletedAccountData] = useState(null)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const isSuccessRef = useRef(false)
  // iOS only opens the soft-keyboard from a focus() that happens *inside* a
  // user gesture. This hidden input is focused synchronously on the "Log in"
  // tap so the keyboard opens, then focus is transferred to the OTP boxes once
  // they mount (focus transfer keeps the keyboard up on iOS).
  const focusKeeperRef = useRef(null)
  const keyboardPrimedRef = useRef(false)

  // Keep the typed number when the user opens Terms / Privacy / Support and comes back.
  const persistLoginPhone = () => {
    try {
      sessionStorage.removeItem("restaurantClearLoginPhone")
      if (phone) sessionStorage.setItem("restaurantLoginPhone", phone)
      else sessionStorage.removeItem("restaurantLoginPhone")
    } catch {
      // ignore
    }
  }

  const getBlockKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `restaurant_block_expires_at_${clean}` : "restaurant_block_expires_at"
  }

  const getResendKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `restaurant_resend_expires_at_${clean}` : "restaurant_resend_expires_at"
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
    if (resendTimer <= 0) return
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return
    const timer = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [blockTimer])

  // Autofocus first OTP box + open mobile keyboard automatically
  useEffect(() => {
    if (isOtpStep) {
      const focusFirst = () => {
        const el = inputRefs.current[0]
        if (el) {
          el.focus()
          // In mobile WebView the soft keyboard often won't open on a
          // programmatic focus alone, so also trigger a click to force it.
          el.click()
        }
      }
      // If the keyboard was primed on the "Log in" tap (iOS), transfer focus
      // ASAP so the already-open keyboard stays up instead of closing.
      if (keyboardPrimedRef.current) {
        keyboardPrimedRef.current = false
        requestAnimationFrame(focusFirst)
        return
      }
      const timer = setTimeout(focusFirst, 250)
      return () => clearTimeout(timer)
    }
  }, [isOtpStep])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    if (digits.length !== 10) return false
    return ["6", "7", "8", "9"].includes(digits[0])
  }

  // Action Step 1: Send OTP
  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    // Prime the keyboard inside the tap gesture so iOS keeps it open while we
    // navigate to the OTP step (Android focuses fine on mount).
    if (focusKeeperRef.current) {
      focusKeeperRef.current.focus()
      keyboardPrimedRef.current = true
    }
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      await restaurantAPI.sendOTP(fullPhone, "login")
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      sessionStorage.setItem("restaurantLoginPhone", phone)
      
      // Navigate to /otp - Since both routes render RestaurantLogin,
      // it transitions inline without unmounting the parent waves!
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

        const authData = {
          method: "phone",
          phone: fullPhone,
          isSignUp: false,
          module: "restaurant",
        }
        sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
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
    const code = otpValue || otp.join("")

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
      )
      const data = response?.data?.data || response?.data

      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
      } else if (data.pendingApproval === true) {
        isSuccessRef.current = true
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setRestaurantPendingPhone(phoneVal)
        const isRejected = Boolean(data.isRejected)
        const statusVal = isRejected ? "rejected" : "pending"
        localStorage.setItem("restaurant_pendingStatus", statusVal)
        localStorage.setItem("restaurant_pendingMessage", data.message || "")
        if (data.pendingToken) localStorage.setItem("restaurant_pendingToken", data.pendingToken)
        setShowRestorePopup(false)
        setLoading(false)
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
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setShowRestorePopup(false)
        window.location.replace("/food/restaurant/onboarding")
      } else {
        isSuccessRef.current = true
        const accessToken = data.accessToken
        const restaurant = data.restaurant || data.user
        const status = String(restaurant?.status || "").toLowerCase()

        if (status && status !== "approved") {
          sessionStorage.removeItem("restaurantAuthData")
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
        } catch {}
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        setShowRestorePopup(false)

        if (authData?.isSignUp) {
          window.location.replace("/food/restaurant/onboarding")
        } else {
          const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
          if (!onboardingComplete) {
            const incompleteStep = await checkOnboardingStatus()
            if (incompleteStep) {
              window.location.replace(`/food/restaurant/onboarding?step=${incompleteStep}`)
              return
            }
          }
          window.location.replace("/food/restaurant")
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
          
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: { 
              phone: pendingPhone || "",
              isRejected: isRejected,
              isDisabled: isDisabled,
              message: message 
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
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 50)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || blockTimer > 0) return
    setLoading(true)
    try {
      const purpose = authData.isSignUp ? "register" : "login"
      await restaurantAPI.sendOTP(authData.phone, purpose, authData.email)
      // The old code is no longer valid, so clear what was typed
      setOtp(["", "", "", ""])
      setOtpError("")
      hasSubmittedRef.current = false
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      setResendTimer(59)
      sessionStorage.setItem(getResendKey(authData.phone), (Date.now() + (59 * 1000)).toString())
      toast.success("OTP resent successfully.")
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code")
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreAction = async (action) => {
    const code = otp.join("")
    await handleVerify(code, action)
  }

  const handleChange = (index, value) => {
    if (index === 0 && value) {
      setOtpError("")
    }

    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 4 - index).split("")
      if (digits.length > 0) {
        const newOtp = [...otp]
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

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value) afterOtpUpdate(newOtp, index < 3 ? index + 1 : null)
  }

  // last digit in: verify straight away (like the app)
  const afterOtpUpdate = (newOtp, nextIndex) => {
    if (newOtp.every((digit) => digit !== "")) {
      handleVerify(newOtp.join(""))
    } else if (nextIndex != null) {
      inputRefs.current[nextIndex]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) newOtp[i] = digit
        })
        setOtp(newOtp)
        inputRefs.current[Math.min(digits.length, 3)]?.focus()
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) newOtp[i] = digit
    })
    setOtp(newOtp)
    afterOtpUpdate(newOtp, Math.min(digits.length, 3))
  }

  const otpPhoneLabel = `+91-${String(authData?.phone || contactInfo || phone).replace(/\D/g, "").slice(-10)}`

  return (
    <>
      {/* Hidden keyboard-keeper: focused on the "Continue" tap so iOS keeps the
          soft-keyboard open while transitioning to the OTP step. */}
      <input
        ref={focusKeeperRef}
        type="tel"
        inputMode="numeric"
        tabIndex={-1}
        aria-label="Keyboard focus keeper"
        readOnly
        className="fixed left-0 top-0 h-px w-px opacity-0 pointer-events-none"
      />

      {!isOtpStep ? (
        <LoginNumberScreen
          appType="restaurant"
          phone={phone}
          onPhoneChange={setPhone}
          phoneInputRef={phoneInputRef}
          onContinue={() => handleSendOTP()}
          loading={loading}
          accent={ACCENT}
          accentPressed={ACCENT_PRESSED}
          fontFamily={LOGIN_FONT}
          legalFrom="/food/restaurant/login"
          onLegalClick={persistLoginPhone}
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
          onOtpKeyDown={handleKeyDown}
          onOtpPaste={handlePaste}
          loading={loading}
          otpError={otpError}
          blockTimer={blockTimer}
          resendTimer={resendTimer}
          onResend={handleResend}
          accent={ACCENT}
          fontFamily={LOGIN_FONT}
          onBack={() => navigate("/food/restaurant/login")}
        />
      )}

      {/* Restore/New Account Popup */}
      <AnimatePresence>
        {showRestorePopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowRestorePopup(false)
                  navigate("/food/restaurant/login")
                }}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 transition-all active:scale-95"
                aria-label="Close and return to login"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-[#B80B3D]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-10 w-10 text-[#B80B3D]" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Restaurant Found!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                An existing deleted restaurant for <span className="font-bold text-gray-900 dark:text-white">{contactInfo}</span> was found.
                Do you want to restore your old data or start fresh with a new account?
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => handleRestoreAction("restore")}
                  className="w-full h-14 bg-gradient-to-r from-[#B80B3D] to-[#66001D] text-white font-bold rounded-2xl shadow-xl shadow-[#B80B3D]/20 transition-all active:scale-[0.98]"
                >
                  Restore My Account
                </button>
                <button
                  onClick={() => handleRestoreAction("new")}
                  className="w-full h-14 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98]"
                >
                  Create New Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
