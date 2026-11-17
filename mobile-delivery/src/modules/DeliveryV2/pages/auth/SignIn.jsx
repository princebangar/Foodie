// Delivery partner login: same look as the customer app login (admin images slider + white sheet, then the white
// "OTP Verification" page; modules/auth/components/PartnerLogin.jsx). Both /food/delivery/login and /food/delivery/otp
// render this screen; the step is read from the path. The API calls, session keys and navigation are the delivery ones.
import React, { useState, useEffect, useRef, useCallback } from "react"
import { Keyboard, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { Phone, X } from "lucide-react-native"
import { useNavigate, useLocation, router } from "@/lib/router"
import { toast } from "@/lib/toast"
import { Dialog, Text, TextInput } from "@/native/ui"
import { LoginExitGuard } from "@/native/ui/LoginExitGuard"
import { alpha, colors, deliveryTheme, shadow } from "@/theme"
import { deliveryAPI } from "@food/api"
import { setAuthData as storeAuthData, clearModuleAuth, setPendingTicket, clearPendingTicket } from "@food/utils/auth"
import { collectFcmTokenFast, persistModuleFcmToken, finalizeDeliveryPendingSubmission, prefetchModuleFcmToken } from "@food/utils/firebaseMessaging"
import { getUserFacingApiError, showUserFacingApiError } from "@/shared/utils/apiError"
import { prefetchPolicyContentWhenIdle } from "@/shared/utils/policyPages"
import { requestPhoneFocus, usePhoneFocusRequest } from "@/shared/utils/loginFocus"
import { LoginNumberScreen, LoginOtpScreen, LoginPrimaryButton, loginStyles } from "@/modules/auth/components/PartnerLogin"

const DEFAULT_COUNTRY_CODE = "+91"
// the app theme colour on the login (Continue button, OTP links, banner backdrop)
const ACCENT = deliveryTheme.primary // #15498B
const ACCENT_PRESSED = "#0F3A70"

export default function DeliverySignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const isOtpStep = location.pathname.endsWith("/otp")
  // Terms / Privacy / Support load in the background so tapping one opens it straight away.
  useEffect(() => prefetchPolicyContentWhenIdle("delivery"), [])

  // Step 1 States
  // Never prefill a number (the old dev "default test phone" leaked into
  // builds). Only what the partner typed is kept, saved on every change.
  const [phone, setPhoneState] = useState(() => {
    try {
      if (sessionStorage.getItem("deliveryClearLoginPhone") === "1") {
        sessionStorage.removeItem("deliveryClearLoginPhone")
        sessionStorage.removeItem("deliveryAuthData")
        sessionStorage.removeItem("deliveryLoginPhone")
        return ""
      }
      const typed = sessionStorage.getItem("deliveryLoginPhone")
      if (typed) return typed
      const stored = sessionStorage.getItem("deliveryAuthData")
      if (stored) {
        const data = JSON.parse(stored)
        return data.phone ? data.phone.replace("+91", "").trim() : ""
      }
    } catch (e) {
      return ""
    }
    return ""
  })
  const setPhone = (value) => {
    setPhoneState(value)
    try {
      if (value) sessionStorage.setItem("deliveryLoginPhone", value)
      else sessionStorage.removeItem("deliveryLoginPhone")
    } catch {
      // ignore
    }
  }
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // Step 2 States
  const [otp, setOtpState] = useState(["", "", "", ""])
  // Latest boxes for the key / change handlers (two quick key presses must not read a stale array).
  const otpRef = useRef(["", "", "", ""])
  const setOtp = (next) => {
    otpRef.current = next
    setOtpState(next)
  }
  const [error, setError] = useState("")
  const [, setSuccess] = useState(false)
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
  const [, setDeletedAccountData] = useState(null)
  const inputRefs = useRef([])
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

  // Web: replace to /food/delivery/login. The login screen is the one under this code screen in the native stack,
  // so going back to it returns there (a replace would leave a second login screen in the stack).
  const goToLoginScreen = () => {
    Keyboard.dismiss()
    if (isOtpStep && router.canGoBack()) navigate(-1)
    else navigate("/food/delivery/login", { replace: true })
  }

  const handleBackToLogin = () => {
    requestPhoneFocus()
    goToLoginScreen()
  }

  useEffect(() => {
    prefetchModuleFcmToken("delivery")
  }, [])

  // Close the keyboard when the screen goes away
  useEffect(() => () => Keyboard.dismiss(), [])

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

  // Timers
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

  // Focus first OTP field + open the keyboard automatically
  useEffect(() => {
    if (isOtpStep && !showNameInput && !pendingMessage) {
      const timer = setTimeout(() => {
        const el = inputRefs.current[0]
        el?.blur()
        el?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOtpStep, showNameInput, pendingMessage])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0])
  }

  // Send OTP (Action Step 1)
  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
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

    const code = otpValue || otpRef.current.join("")

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

      // Lets the "under review" screen log in by itself once admin approves.
      if (data?.pendingToken || data?.pendingTicket) setPendingTicket("delivery", data.pendingToken || data.pendingTicket)
      else if (data?.accessToken) clearPendingTicket("delivery")

      if (data?.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        return
      }

      if (data.pendingApproval === true) {
        sessionStorage.removeItem("deliveryAuthData")
        sessionStorage.removeItem("deliveryLoginPhone")
        sessionStorage.removeItem(getBlockKey(phoneVal))
        sessionStorage.removeItem(getResendKey(phoneVal))
        const digits = String(phoneVal || "").replace(/\D/g, "").slice(-10)
        const rejected = Boolean(data.isRejected)
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
        sessionStorage.removeItem("deliveryLoginPhone")
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
      sessionStorage.removeItem("deliveryLoginPhone")
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
      } catch {
        // ignore
      }
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

      // wrong code: boxes emptied, cursor back in the first box with the keyboard open
      setOtp(["", "", "", ""])
      focusOtpBox(0, 150)

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
      sessionStorage.removeItem("deliveryLoginPhone")

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
    const code = otpRef.current.join("")
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
      focusOtpBox(0, 50)
      toast.success("OTP resent successfully.", { duration: 3000 })
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
      setError("")
    }

    const current = otpRef.current
    // a box keeps its digit selected on focus; typing over it on a keyboard that does not replace the selection gives
    // "old+new": keep the new digit only
    if (value.length === 2 && current[index] && value.startsWith(current[index])) {
      value = value.slice(1)
    }

    if (value.length > 1) {
      // pasted / auto-filled code
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
      } else if (current[index]) {
        const newOtp = [...current]
        newOtp[index] = ""
        setOtp(newOtp)
      }
    }
  }

  const getPhoneNumber = () => {
    const p = authData?.phone || `${DEFAULT_COUNTRY_CODE} ${phone}`
    const cleaned = p.replace(/\s/g, "")
    if (cleaned.startsWith("+91") && cleaned.length > 3) {
      return cleaned.slice(0, 3) + " " + cleaned.slice(3)
    }
    return cleaned
  }

  const showLoginStep = !isOtpStep

  const closeRestorePopup = () => {
    setShowRestorePopup(false)
    goToLoginScreen()
  }

  const otpPhoneLabel = `+91-${String(authData?.phone || phone).replace(/\D/g, "").slice(-10)}`

  return (
    <View style={styles.root}>
      <LoginExitGuard enabled={showLoginStep} dirty={phone.length > 0} accent={ACCENT} />

      {showLoginStep ? (
        <LoginNumberScreen
          appType="delivery"
          phone={phone}
          onPhoneChange={setPhone}
          phoneInputRef={phoneInputRef}
          onContinue={handleSendOTP}
          loading={loading}
          accent={ACCENT}
          accentPressed={ACCENT_PRESSED}
          legalFrom="/food/delivery/login"
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
          onOtpKeyPress={handleKeyDown}
          loading={loading}
          otpError={error}
          blockTimer={blockTimer}
          resendTimer={resendTimer}
          onResend={handleResend}
          accent={ACCENT}
          onBack={handleBackToLogin}
        >
          {pendingMessage ? (
            <View style={[styles.pendingCard, isRejected ? styles.pendingRejected : styles.pendingAmber]}>
              <View style={{ gap: 8 }}>
                <Text style={[styles.pendingTitle, { color: isRejected ? colors.red[700] : colors.amber[700] }]}>
                  {isRejected ? "APPLICATION REJECTED" : "PENDING VERIFICATION"}
                </Text>
                <Text style={[styles.pendingMsg, { color: alpha(isRejected ? colors.red[600] : colors.amber[600], 0.9) }]}>
                  {pendingMessage}
                </Text>
                {isRejected && rejectionReason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>REASON</Text>
                    <Text style={styles.reasonText}>{`"${rejectionReason}"`}</Text>
                  </View>
                ) : null}
              </View>
              {isRejected ? (
                <LoginPrimaryButton accent={ACCENT} accentPressed={ACCENT_PRESSED}
                  label="Re-apply Now"
                  onPress={() => {
                    const digits = String(authData?.phone || "").replace(/\D/g, "")
                    sessionStorage.setItem("deliveryNeedsRegistration", "true")
                    sessionStorage.setItem("deliverySignupDetails", JSON.stringify({ name: "", phone: digits.slice(-10), countryCode: "+91" }))
                    navigate("/food/delivery/signup/details", { replace: true })
                  }}
                />
              ) : null}
            </View>
          ) : showNameInput ? (
            <View style={{ marginTop: 32, gap: 16, paddingHorizontal: 12 }}>
              <Text style={styles.nameLabel}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value)
                  if (nameError) setNameError("")
                }}
                editable={!loading}
                placeholder="Enter your name"
                placeholderTextColor="#AFB4C0"
                style={[loginStyles.field, styles.nameInput, nameError ? { borderColor: colors.red[500] } : null]}
              />
              {nameError ? <Text style={styles.nameError}>{nameError}</Text> : null}
              {error ? <Text style={styles.nameError}>{error}</Text> : null}
              <LoginPrimaryButton accent={ACCENT} accentPressed={ACCENT_PRESSED} label="Continue" onPress={handleSubmitName} loading={loading} disabled={!name.trim()} />
            </View>
          ) : null}
        </LoginOtpScreen>
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

        <Text style={styles.restoreTitle}>Account Found!</Text>
        <Text style={styles.restoreText}>
          {"A deleted delivery account for "}
          <Text style={{ fontWeight: "700", color: colors.gray[900] }}>{getPhoneNumber()}</Text>
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
  nameLabel: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: colors.gray[700] },
  nameInput: { paddingHorizontal: 16, fontSize: 18, color: "#1C1C1C", paddingVertical: 0 },
  nameError: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.red[600] },
  pendingCard: { marginTop: 32, marginHorizontal: 12, borderRadius: 16, borderWidth: 1, padding: 17.6, gap: 20 },
  pendingRejected: { backgroundColor: colors.red[50], borderColor: colors.red[200] },
  pendingAmber: { backgroundColor: colors.amber[50], borderColor: colors.amber[200] },
  pendingTitle: { fontSize: 16, lineHeight: 24, fontWeight: "800", letterSpacing: 0.8, textAlign: "center" },
  pendingMsg: { fontSize: 14, lineHeight: 22, fontWeight: "500", textAlign: "center" },
  reasonBox: { marginTop: 12, padding: 16, backgroundColor: alpha("#ffffff", 0.7), borderRadius: 16, borderWidth: 1, borderColor: colors.red[100] },
  reasonLabel: { fontSize: 10, fontWeight: "900", color: colors.red[600], letterSpacing: 1.5, marginBottom: 4, textAlign: "center" },
  reasonText: { fontSize: 14, lineHeight: 20, color: colors.red[800], fontStyle: "italic", fontWeight: "500", textAlign: "center" },
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
