import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { deliveryAPI } from "@food/api"
import { setAuthData as storeAuthData, clearModuleAuth } from "@food/utils/auth"
import { collectFcmTokenFast, persistModuleFcmToken, finalizeDeliveryPendingSubmission, prefetchModuleFcmToken } from "@food/utils/firebaseMessaging"
import { getUserFacingApiError, showUserFacingApiError } from "@/shared/utils/apiError"
import { LoginNumberScreen, LoginOtpScreen, LoginPrimaryButton } from "@/modules/auth/components/PartnerLogin"

// Same look as the Delivery app login (admin images slider + white sheet, then the white "OTP Verification" page).
const ACCENT = "#15498B"
const ACCENT_PRESSED = "#0F3A70"
const LOGIN_FONT = "'Nunito Sans', 'Poppins', sans-serif"

const DEFAULT_COUNTRY_CODE = "+91"

export default function DeliverySignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const isOtpStep = location.pathname.endsWith("/otp")

  // Step 1 States
  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : ""

  const [phone, setPhone] = useState(() => {
    try {
      if (sessionStorage.getItem("deliveryClearLoginPhone") === "1") {
        sessionStorage.removeItem("deliveryClearLoginPhone")
        sessionStorage.removeItem("deliveryAuthData")
        // return ""
        return defaultTestPhone
      }
      const stored = sessionStorage.getItem("deliveryAuthData")
      if (stored) {
        const data = JSON.parse(stored)
        // return data.phone ? data.phone.replace("+91", "").trim() : ""
        return data.phone ? data.phone.replace("+91", "").trim() : defaultTestPhone
      }
    } catch (e) {
      // return ""
      return defaultTestPhone
    }
    // return ""
    return defaultTestPhone
  })
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // Step 2 States
  const [otp, setOtp] = useState(["", "", "", ""])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [blockTimer, setBlockTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [pendingMessage, setPendingMessage] = useState("")
  const [isRejected, setIsRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("web")
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [deletedAccountData, setDeletedAccountData] = useState(null)
  const inputRefs = useRef([])
  // iOS only opens the soft-keyboard from a focus() that happens *inside* a
  // user gesture. This hidden input is focused synchronously on the "Log in"
  // tap so the keyboard opens, then focus is transferred to the OTP boxes once
  // they mount (focus transfer keeps the keyboard up on iOS).
  const focusKeeperRef = useRef(null)
  const keyboardPrimedRef = useRef(false)
  const [instantAuthTransition, setInstantAuthTransition] = useState(false)

  const clearPersistedLoginPhone = () => {
    try {
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.setItem("deliveryClearLoginPhone", "1")
    } catch {
      // ignore
    }
    setPhone("")
  }

  const getBlockKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `delivery_block_expires_at_${clean}` : "delivery_block_expires_at"
  }

  const getResendKey = (phoneStr) => {
    const clean = phoneStr?.replace(/\D/g, "") || ""
    return clean ? `delivery_resend_expires_at_${clean}` : "delivery_resend_expires_at"
  }

  const resetPendingVerificationState = () => {
    setPendingMessage("")
    setIsRejected(false)
    setRejectionReason("")
  }

  const handleBackToLogin = () => {
    setInstantAuthTransition(true)
    navigate("/food/delivery/login", { replace: true })
  }

  useEffect(() => {
    prefetchModuleFcmToken("delivery")
  }, [])

  // Handle route change transitions
  useEffect(() => {
    if (!isOtpStep) {
      setOtp(["", "", "", ""])
      setError("")
      setShowNameInput(false)
      resetPendingVerificationState()
      return
    }

    const stored = sessionStorage.getItem("deliveryAuthData")
    let currentPhone = ""
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)
      currentPhone = data.phone || ""
    } else {
      navigate("/food/delivery/login", { replace: true })
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

  useEffect(() => {
    if (!instantAuthTransition || isOtpStep) return
    const timer = window.setTimeout(() => setInstantAuthTransition(false), 0)
    return () => window.clearTimeout(timer)
  }, [instantAuthTransition, isOtpStep])

  // Timers
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

  // Focus first OTP field + open mobile keyboard automatically
  useEffect(() => {
    if (isOtpStep && !showNameInput && !pendingMessage) {
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
  }, [isOtpStep, showNameInput, pendingMessage])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0])
  }

  // Send OTP (Action Step 1)
  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    // Prime the keyboard inside the tap gesture so iOS keeps it open while we
    // navigate to the OTP step (Android focuses fine on mount).
    if (focusKeeperRef.current) {
      focusKeeperRef.current.focus()
      keyboardPrimedRef.current = true
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      clearModuleAuth("delivery")
      await deliveryAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))
      navigate("/food/delivery/otp")
    } catch (err) {
      const msg = getUserFacingApiError(err, "Failed to send OTP. Please try again.")
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
          purpose: "login",
          module: "delivery",
        }
        sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))
        navigate("/food/delivery/otp", { state: { initialBlockMins: totalMins } })
        return
      }
      showUserFacingApiError(err, "Failed to send OTP. Please try again.")
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  // Verify OTP (Action Step 2)
  const handleVerify = async (otpValue = null, confirmAction = null) => {
    if (showNameInput && !confirmAction) return

    const code = otpValue || otp.join("")

    if (code.length !== 4) {
      toast.error("Please enter the complete 4-digit code")
      return
    }

    if (loading || blockTimer > 0) return

    setLoading(true)
    setError("")

    try {
      const phoneVal = authData?.phone
      const purpose = authData?.purpose || "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      if (!phoneVal) {
        setError("Phone number not found. Please try again.")
        setLoading(false)
        return
      }

      const { fcmToken, platform } = await collectFcmTokenFast("delivery")

      setDeviceToken(fcmToken)
      setActivePlatform(platform)

      const response = await deliveryAPI.verifyOTP(phoneVal, code, purpose, providedName, fcmToken, platform, confirmAction)
      const data = response?.data?.data || response?.data || {}

      if (data?.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        return
      }

      if (data.pendingApproval === true) {
        sessionStorage.removeItem("deliveryAuthData")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        const digits = String(phoneVal || "").replace(/\D/g, "").slice(-10)
        const rejected = Boolean(data.isRejected)
        if (data.pendingToken) localStorage.setItem("delivery_pendingToken", data.pendingToken)
        setLoading(false)
        finalizeDeliveryPendingSubmission(
          navigate,
          digits,
          {
            fcmToken,
            platform,
            status: rejected ? "rejected" : "pending",
            message: data.message,
            rejectionReason: data.rejectionReason,
          },
        )
        return
      }

      const needsRegistration = data.needsRegistration === true

      if (needsRegistration) {
        sessionStorage.removeItem("deliveryAuthData")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        sessionStorage.setItem("deliveryNeedsRegistration", "true")
        const digits = String(phoneVal || "").replace(/\D/g, "")
        const details = {
          name: "",
          phone: digits.slice(-10),
          countryCode: "+91",
        }
        sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
        navigate("/food/delivery/signup/details", { replace: true })
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem(getBlockKey(phoneVal))
      sessionStorage.removeItem(getResendKey(phoneVal))

      try {
        storeAuthData("delivery", accessToken, user, refreshToken)
      } catch (storageError) {
        setError("Failed to save authentication. Please try again.")
        setLoading(false)
        return
      }

      window.dispatchEvent(new Event("deliveryAuthChanged"))
      try {
        await persistModuleFcmToken("delivery", { maxAttempts: 8, delayMs: 400 })
      } catch {}
      setSuccess(true)

      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")

        if (storedToken && storedAuth === "true") {
          navigate("/food/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          setError("Failed to save authentication. Please try again.")
          setLoading(false)
        }
      }
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      const message = getUserFacingApiError(err, "Failed to verify OTP. Please try again.")

      setOtp(["", "", "", ""])
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 50)

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
        setError("")
      } else if (/invalid/i.test(message)) {
        setError("Invalid OTP")
        toast.error("Invalid OTP", { id: "user-facing-api-error" })
      } else {
        setError(message)
        showUserFacingApiError(err, message)
      }
      setLoading(false)
    }
  }

  // Name Submission (Action Step 3)
  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setLoading(true)
    setError("")
    setNameError("")

    try {
      const phoneVal = authData?.phone
      const purpose = authData?.purpose || "login"
      if (!phoneVal) {
        setError("Phone number not found. Please try again.")
        return
      }

      const response = await deliveryAPI.verifyOTP(phoneVal, verifiedOtp, purpose, trimmedName, deviceToken, activePlatform)
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      sessionStorage.removeItem("deliveryAuthData")

      try {
        storeAuthData("delivery", accessToken, user, refreshToken)
      } catch (storageError) {
        setError("Failed to save authentication. Please try again.")
        setLoading(false)
        return
      }

      window.dispatchEvent(new Event("deliveryAuthChanged"))
      setSuccess(true)
      setLoading(false)

      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")

        if (storedToken && storedAuth === "true") {
          navigate("/food/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          setError("Failed to save authentication. Please try again.")
          setLoading(false)
        }
      }
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      const message = getUserFacingApiError(err, "Failed to complete registration. Please try again.")
      setError(message)
      showUserFacingApiError(err, "Failed to complete registration. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreAction = async (action) => {
    setShowRestorePopup(false)
    const code = otp.join("")
    await handleVerify(code, action)
  }

  const handleResend = async () => {
    if (resendTimer > 0 || blockTimer > 0) return

    setLoading(true)
    setError("")

    try {
      const phoneVal = authData?.phone
      const purpose = authData?.purpose || "login"
      if (!phoneVal) {
        setError("Phone number not found. Please go back and try again.")
        setLoading(false)
        return
      }

      await deliveryAPI.sendOTP(phoneVal, purpose)
      setResendTimer(59)
      sessionStorage.setItem(getResendKey(phoneVal), (Date.now() + (59 * 1000)).toString())
      setOtp(["", "", "", ""])
      setShowNameInput(false)
      setName("")
      setNameError("")
      setVerifiedOtp("")
      inputRefs.current[0]?.focus()
      toast.success("OTP resent successfully.")
    } catch (err) {
      const message = getUserFacingApiError(err, "Failed to resend OTP. Please try again.")

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
        setError("")
      } else {
        setError(message)
        showUserFacingApiError(err, "Failed to resend OTP. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (index, value) => {
    if (index === 0 && value) {
      setError("")
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
      } else if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
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

  const getPhoneNumber = () => {
    const p = authData?.phone || `${DEFAULT_COUNTRY_CODE} ${phone}`
    const cleaned = p.replace(/\s/g, "")
    if (cleaned.startsWith("+91") && cleaned.length > 3) {
      return cleaned.slice(0, 3) + " " + cleaned.slice(3)
    }
    return cleaned
  }

  const showLoginStep = !isOtpStep || instantAuthTransition

  const otpPhoneLabel = `+91-${String(authData?.phone || phone).replace(/\D/g, "").slice(-10)}`

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

      {showLoginStep ? (
        <LoginNumberScreen
          appType="delivery"
          phone={phone}
          onPhoneChange={setPhone}
          onContinue={() => handleSendOTP()}
          loading={loading}
          accent={ACCENT}
          accentPressed={ACCENT_PRESSED}
          fontFamily={LOGIN_FONT}
          legalFrom="/food/delivery/login"
          onLegalClick={clearPersistedLoginPhone}
          legalLinks={[
            { to: "/food/delivery/terms", label: "Terms of Service" },
            { to: "/food/delivery/privacy", label: "Privacy Policy" },
            { to: "/food/delivery/help/content", label: "Support" },
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
          otpError={error}
          blockTimer={blockTimer}
          resendTimer={resendTimer}
          onResend={handleResend}
          accent={ACCENT}
          fontFamily={LOGIN_FONT}
          onBack={handleBackToLogin}
        >
          {pendingMessage ? (
            <div className={`mx-3 mt-8 space-y-4 rounded-2xl border p-5 text-center ${isRejected ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="space-y-2">
                <p className={`text-[15px] font-extrabold uppercase tracking-wider ${isRejected ? "text-red-700" : "text-amber-700"}`}>
                  {isRejected ? "Application Rejected" : "Pending Verification"}
                </p>
                <p className={`text-sm font-medium leading-relaxed ${isRejected ? "text-red-600/90" : "text-amber-600/90"}`}>
                  {pendingMessage}
                </p>
                {isRejected && rejectionReason ? (
                  <div className="mt-3 rounded-xl border border-red-100 bg-white/70 p-4">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-red-600">Reason</p>
                    <p className="text-sm font-medium italic text-red-800">"{rejectionReason}"</p>
                  </div>
                ) : null}
              </div>
              {isRejected ? (
                <LoginPrimaryButton
                  accent={ACCENT}
                  accentPressed={ACCENT_PRESSED}
                  label="Re-apply Now"
                  onClick={() => {
                    const digits = String(authData?.phone || "").replace(/\D/g, "")
                    sessionStorage.setItem("deliveryNeedsRegistration", "true")
                    sessionStorage.setItem("deliverySignupDetails", JSON.stringify({ name: "", phone: digits.slice(-10), countryCode: "+91" }))
                    navigate("/food/delivery/signup/details", { replace: true })
                  }}
                />
              ) : null}
            </div>
          ) : showNameInput ? (
            <div className="mt-8 space-y-4 px-3">
              <label className="block text-[15px] font-semibold text-[#1C1C1C]">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError("")
                }}
                disabled={loading}
                placeholder="Enter your name"
                style={{ caretColor: ACCENT }}
                className={`h-12 w-full rounded-lg border bg-white px-4 text-[17px] text-[#1C1C1C] shadow-[0_1px_2px_rgba(28,28,28,0.12)] outline-none placeholder:text-[#AFB4C0] ${nameError ? "border-red-500" : "border-[#D0D4DC]"}`}
              />
              {nameError ? <p className="text-[13px] text-red-500">{nameError}</p> : null}
              {error ? <p className="text-[13px] text-red-500">{error}</p> : null}
              <LoginPrimaryButton
                accent={ACCENT}
                accentPressed={ACCENT_PRESSED}
                label="Continue"
                onClick={handleSubmitName}
                loading={loading}
                disabled={!name.trim()}
              />
            </div>
          ) : null}
        </LoginOtpScreen>
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
              onClick={() => {
                setShowRestorePopup(false)
                navigate("/food/delivery/login")
              }}
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
                  navigate("/food/delivery/login")
                }}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 transition-all active:scale-95"
                aria-label="Close and return to login"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-[#0E4B9C]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-10 w-10 text-[#0E4B9C]" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Account Found!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                An existing deleted delivery account for <span className="font-bold text-gray-900 dark:text-white">{getPhoneNumber()}</span> was found.
                Do you want to restore your old data or start fresh with a new account?
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => handleRestoreAction("restore")}
                  className="w-full h-14 bg-gradient-to-r from-[#0E4B9C] to-[#021024] text-white font-bold rounded-2xl shadow-xl shadow-[#0E4B9C]/20 transition-all active:scale-[0.98]"
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
