import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Phone, Loader2, X, User } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import {
  LoginImageSlider,
  LoginSliderDots,
  useLoginImageSlider,
} from "../components/LoginImageSlider"

// How far the slider stops short of the screen bottom. Always less than the
// sheet's height, so the slider's bottom edge stays hidden behind the sheet.
const SLIDER_BOTTOM_INSET = 236

const FIELD_CLASS =
  "h-12 rounded-xl border border-[#E8E8EE] bg-white transition-shadow group-focus-within:border-transparent group-focus-within:shadow-[0_2px_10px_rgba(28,28,43,0.16)] dark:border-gray-700 dark:bg-gray-900"
const PRIMARY_BUTTON_CLASS =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B80B3D] text-[17px] font-medium text-white transition-colors hover:bg-[#A10935] active:bg-[#90082E]"

function IndiaFlag() {
  return (
    <svg viewBox="0 0 30 20" className="h-5 w-[30px] rounded-[3px]" role="img" aria-label="India">
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="6.67" width="30" height="6.66" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="15" cy="10" r="0.5" fill="#000080" />
      {Array.from({ length: 12 }, (_, spoke) => (
        <line
          key={spoke}
          x1="15"
          y1="10"
          x2="15"
          y2="7.4"
          stroke="#000080"
          strokeWidth="0.25"
          transform={`rotate(${spoke * 30} 15 10)`}
        />
      ))}
    </svg>
  )
}

/**
 * Follows the on-screen keyboard: `height` shrinks with it so the sheet rides
 * above the keys, while `baseHeight` stays put so the slider doesn't resize.
 */
function useKeyboardAwareViewport() {
  const [viewport, setViewport] = useState(() => ({
    height: window.innerHeight,
    baseHeight: window.innerHeight,
    top: 0,
  }))

  useEffect(() => {
    const visual = window.visualViewport
    let lastWidth = window.innerWidth

    const update = () => {
      const height = visual?.height ?? window.innerHeight
      const widthChanged = window.innerWidth !== lastWidth
      lastWidth = window.innerWidth
      setViewport((previous) => ({
        height,
        baseHeight: widthChanged ? height : Math.max(previous.baseHeight, height),
        top: visual?.offsetTop ?? 0,
      }))
    }

    visual?.addEventListener("resize", update)
    visual?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    return () => {
      visual?.removeEventListener("resize", update)
      visual?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return viewport
}


export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 59
  const defaultTestPhone =
    import.meta.env.VITE_USE_DEFAULT_TEST_PHONE === "true"
      ? String(import.meta.env.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10)
      : ""
  // const [phoneNumber, setPhoneNumber] = useState("")
  const [phoneNumber, setPhoneNumber] = useState(defaultTestPhone)
  const [otp, setOtp] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [otpError, setOtpError] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [deletedAccountData, setDeletedAccountData] = useState(null)
  const [blockTimer, setBlockTimer] = useState(0)
  const navigate = useNavigate()
  const slider = useLoginImageSlider("user")
  const viewport = useKeyboardAwareViewport()
  const submitting = useRef(false)
  // iOS only opens the soft-keyboard from a focus() that happens *inside* a
  // user gesture. This hidden input is focused synchronously on the "Log in"
  // tap so the keyboard opens, then focus is transferred to the OTP boxes once
  // they mount (focus transfer keeps the keyboard up on iOS).
  const focusKeeperRef = useRef(null)
  const keyboardPrimedRef = useRef(false)

  // --- PERSISTENCE LOGIC START ---
  const SESSION_KEY = "user_auth_session_data";

  // Rehydrate state on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
        if (parsed.step) setStep(parsed.step);
        if (parsed.showNameModal !== undefined) setShowNameModal(parsed.showNameModal);
        if (parsed.newName) setNewName(parsed.newName);
        if (parsed.tempAuth) setTempAuth(parsed.tempAuth);
        if (parsed.pendingVerify) setPendingVerify(parsed.pendingVerify);
        if (parsed.showRestorePopup !== undefined) setShowRestorePopup(parsed.showRestorePopup);
        if (parsed.deletedAccountData) setDeletedAccountData(parsed.deletedAccountData);

        // Resume Resend Timer
        if (parsed.resendExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.resendExpiresAt - Date.now()) / 1000));
          if (remaining > 0) setResendTimer(remaining);
        }

        // Resume Block Timer
        if (parsed.blockExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.blockExpiresAt - Date.now()) / 1000));
          if (remaining > 0) {
            setBlockTimer(remaining);
            if (parsed.step === 1) setStep(2); // Ensure we show step 2 if blocked
          }
        }
      } catch (e) {
        console.error("Failed to rehydrate login state", e);
      }
    }
  }, []);

  // Persist state on change
  useEffect(() => {
    if (step === 1 && !phoneNumber && !blockTimer && !showNameModal && !showRestorePopup) {
      // Don't save empty initial state
      return;
    }

    const stateToSave = {
      phoneNumber,
      step,
      showNameModal,
      newName,
      tempAuth,
      pendingVerify,
      showRestorePopup,
      deletedAccountData,
      // Save expiration timestamps instead of seconds
      resendExpiresAt: resendTimer > 0 ? Date.now() + (resendTimer * 1000) : null,
      blockExpiresAt: blockTimer > 0 ? Date.now() + (blockTimer * 1000) : null,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
  }, [phoneNumber, step, showNameModal, newName, tempAuth, pendingVerify, showRestorePopup, deletedAccountData, resendTimer === 0, blockTimer === 0]);

  // Combined cleanup helper
  const clearSessionData = () => {
    sessionStorage.removeItem(SESSION_KEY);
  };
  // --- PERSISTENCE LOGIC END ---

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      setPhoneError("Please enter a valid 10-digit mobile number")
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
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setOtpError("")
      setBlockTimer(0)
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      const lowerMsg = msg.toLowerCase();
      const isBlocked = lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after");

      if (isBlocked) {
        let totalSeconds = 180; // default 3 mins
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          totalSeconds = (mins * 60) + secs;
        }

        setBlockTimer(totalSeconds);
        setStep(2);
        return;
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || blockTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      const lowerMsg = msg.toLowerCase();
      const isBlocked = lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after");

      if (isBlocked) {
        let totalSeconds = 180;
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          totalSeconds = (mins * 60) + secs;
        }

        setBlockTimer(totalSeconds);
        return;
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setShowNameModal(false)
    setShowRestorePopup(false)
    setDeletedAccountData(null)
    setPendingVerify(null)
    setBlockTimer(0) // Clear block timer when changing number
    setOtpError("") // Clear error
    setOtp("") // Clear inputs
    setStep(1)
    setResendTimer(0)

    if (step === 2) {
      // This naturally triggers the popstate listener which pops the navigation state
      window.history.back()
    }
  }

  const handleVerifyOTP = async (e, customOtp = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const code = typeof customOtp === "string" ? customOtp : otp
    const otpDigits = String(code).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    await processVerify(phoneNumber, otpDigits)
  }

  const processVerify = async (phone, otpCode, confirmAction = null) => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            // Optimization: Try only the most common handler to save time
            try {
              const t = await window.flutter_inappwebview.callHandler("getFcmToken", { module: "user" });
              if (t && typeof t === "string" && t.length > 20) fcmToken = t.trim();
            } catch (e) { }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phone, otpCode, "login", null, null, "user", null, null, fcmToken, platform, null, confirmAction)
      const data = response?.data?.data || response?.data || {}

      // Handle deleted account found
      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        submitting.current = false
        return
      }

      // Handle name required (Success response with flag)
      if (data.needsName) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction // Preserve the action (new) for the subsequent name submission
        })
        setShowNameModal(true)
        setLoading(false)
        submitting.current = false
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid parameters from server")
      }

      setAuthData("user", accessToken, user, refreshToken)

      // If user has no name, show name modal instead of immediate navigation
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken })
        setShowNameModal(true)
      } else {
        clearSessionData()
        navigate("/food/user", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."

      // Clear OTP inputs on failure
      setOtp("")
      setTimeout(() => {
        document.getElementById("otp-0")?.focus()
      }, 50)

      if (msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("too many attempts")) {
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          setBlockTimer((mins * 60) + secs);
          msg = ""; // Clear msg so only block UI displays
        }
      }

      // Legacy check for string-based name requirement (backward compatibility)
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setShowRestorePopup(false)
        setPendingVerify({
          phone: phoneNumber,
          otp: otpCode,
          fcmToken,
          platform,
          confirmAction
        })
        setShowNameModal(true)
        return
      }

      if (status === 401 && msg) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
          toast.error(msg)
        } else {
          setOtpError("Invalid OTP")
        }
      } else if (msg) {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
          null, // _token
          pendingVerify.confirmAction // Pass the preserved action
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        clearSessionData()
        setShowNameModal(false)
        navigate("/food/user", { replace: true })
        return
      }

      // Call update profile API
      await userAPI.updateProfile({ name: newName.trim() })

      // Update local storage and auth data with the new name
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      clearSessionData()
      setShowNameModal(false)
      navigate("/food/user", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
      console.error(err)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return
    const intervalId = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [blockTimer])

  useEffect(() => {
    if (step === 2) {
      const focusFirst = () => {
        const el = document.getElementById("otp-0");
        if (el) {
          el.focus();
          // In mobile WebView the soft keyboard often won't open on a
          // programmatic focus alone, so also trigger a click to force it.
          el.click();
        }
      };
      // If the keyboard was primed on the "Log in" tap (iOS), transfer focus
      // ASAP so the already-open keyboard stays up instead of closing.
      if (keyboardPrimedRef.current) {
        keyboardPrimedRef.current = false;
        requestAnimationFrame(focusFirst);
        return;
      }
      setTimeout(focusFirst, 250);
    }
  }, [step]);

  // Intercept hardware back button to return to step 1 instead of leaving the page
  useEffect(() => {
    const handlePopState = () => {
      if (step === 2) {
        if (blockTimer > 0) {
          // Push state again to keep user locked on step 2
          window.history.pushState({ otpStep: true }, "")
          return
        }
        // Back from OTP, "Enter name" or the restore popup always returns to the phone step
        setShowNameModal(false)
        setShowRestorePopup(false)
        setDeletedAccountData(null)
        setPendingVerify(null)
        setNewName("")
        setStep(1)
        setOtp("")
        setOtpError("")
        setResendTimer(0)
      }
    }

    if (step === 2) {
      window.history.pushState({ otpStep: true }, "")
      window.addEventListener("popstate", handlePopState)
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [step, blockTimer > 0])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const primaryColor = "#DC2626" // Rebranded Red color

  return (
    <div
      className="fixed inset-x-0 flex justify-center overflow-hidden bg-black"
      style={{ top: viewport.top, height: viewport.height, fontFamily: "'Figtree', sans-serif" }}
    >
      <div className="relative h-full w-full md:max-w-[480px]">
        <LoginImageSlider
          slider={slider}
          height={Math.max(viewport.baseHeight - SLIDER_BOTTOM_INSET, 0)}
        />

        {/* Hidden keyboard-keeper: focused on the "Continue" tap so iOS keeps the
            soft-keyboard open while transitioning to the OTP step. */}
        <input
          ref={focusKeeperRef}
          type="tel"
          inputMode="numeric"
          tabIndex={-1}
          aria-label="Keyboard focus keeper"
          readOnly
          className="absolute h-px w-px opacity-0 pointer-events-none"
        />

        {step === 1 && blockTimer <= 0 && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("user_authenticated", "false");
              clearSessionData();
              navigate('/food/user');
            }}
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
            className="absolute right-3 z-10 rounded-full bg-black/75 px-4 py-1.5 text-[15px] font-normal text-white"
          >
            Skip
          </button>
        )}

        {step === 2 && (
          <button
            type="button"
            onClick={handleEditNumber}
            aria-label="Go back and change number"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
            className="absolute left-3 z-10 rounded-full bg-black/75 p-2 text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {/* Bottom sheet */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col">
          <div className="pb-3">
            <LoginSliderDots count={slider.images.length} activeIndex={slider.index} />
          </div>

          <div
            className="overflow-y-auto rounded-t-[24px] bg-white px-4 pt-6 min-[360px]:px-6 dark:bg-[#0a0a0a]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onSubmit={handleSendOTP}
                  noValidate
                >
                  <h1 className="mb-5 text-center text-[17px] font-semibold text-[#2B2D42] dark:text-white">
                    Log in or sign up
                  </h1>

                  <div className="group flex gap-2 min-[360px]:gap-3">
                    <div className={`${FIELD_CLASS} flex w-[60px] shrink-0 items-center justify-center min-[360px]:w-[72px]`}>
                      <IndiaFlag />
                    </div>
                    <label className={`${FIELD_CLASS} flex min-w-0 flex-1 items-center gap-2 px-3 min-[360px]:gap-2.5 min-[360px]:px-4`}>
                      <span className="text-[16px] font-medium text-[#2B2D42] dark:text-white">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-label="Mobile number"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                          setPhoneError("")
                        }}
                        maxLength={10}
                        className="w-full min-w-0 bg-transparent text-[17px] font-medium tracking-[0.01em] text-[#2B2D42] outline-none placeholder:font-normal placeholder:text-[15px] placeholder:text-[#9A9CAE] min-[360px]:placeholder:text-[17px] dark:text-white"
                        placeholder="Enter Mobile Number"
                      />
                    </label>
                  </div>

                  {phoneError && (
                    <p role="alert" className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-500">
                      {phoneError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`${PRIMARY_BUTTON_CLASS} mt-4`}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onSubmit={handleVerifyOTP}
                  noValidate
                >
                  <h1 className="text-center text-[17px] font-semibold text-[#2B2D42] dark:text-white">
                    OTP Verification
                  </h1>
                  <p className="mt-1.5 text-center text-[14px] text-[#696B7E] dark:text-gray-400">
                    We've sent a code to <span className="font-medium text-[#2B2D42] dark:text-white">+91 {phoneNumber}</span>
                  </p>

                  {otpError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      role="alert"
                      className="mt-3 text-center text-[14px] font-medium text-red-600 dark:text-red-500"
                    >
                      {otpError}
                    </motion.p>
                  )}

                  <div className="mt-5 flex justify-center gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        aria-label={`Digit ${index + 1} of the OTP`}
                        disabled={loading || blockTimer > 0}
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1);
                          if (index === 0 && val) {
                            setOtpError("");
                          }
                          if (!val) return;
                          const newOtp = otp.split("");
                          newOtp[index] = val;
                          const combined = newOtp.join("").slice(0, 4);
                          setOtp(combined);
                          if (index < 3 && val) {
                            document.getElementById(`otp-${index + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) {
                              document.getElementById(`otp-${index - 1}`)?.focus();
                            } else {
                              const newOtp = otp.split("");
                              newOtp[index] = "";
                              setOtp(newOtp.join(""));
                            }
                          }
                        }}
                        className={`h-14 w-14 rounded-xl border border-[#E8E8EE] bg-white text-center text-[22px] font-semibold text-[#2B2D42] outline-none transition-shadow focus:border-transparent focus:shadow-[0_2px_10px_rgba(28,28,43,0.16)] dark:border-gray-700 dark:bg-gray-900 dark:text-white ${blockTimer > 0 ? "cursor-not-allowed border-red-400 bg-red-50 text-red-800 opacity-50" : ""}`}
                      />
                    ))}
                  </div>

                  <div className="mt-4 text-center text-[14px]">
                    {blockTimer > 0 ? (
                      <span className="text-[#9A9CAE]">Resend SMS</span>
                    ) : resendTimer > 0 ? (
                      <span className="text-[#696B7E] dark:text-gray-400">
                        Resend SMS in <span className="font-semibold text-[#2B2D42] dark:text-white">{formatResendTimer(resendTimer)}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        className="font-medium text-[#2B2D42] hover:underline dark:text-white"
                      >
                        Didn't receive SMS? Resend SMS
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 4 || blockTimer > 0}
                    className={`${PRIMARY_BUTTON_CLASS} mt-4 disabled:opacity-50`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Continue"
                    )}
                  </button>

                  {blockTimer > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-4 w-fit rounded-xl border border-red-100 bg-red-50 px-6 py-2.5 text-center dark:border-red-900/50 dark:bg-red-950/20">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#B80B3D]">
                        Too many failed attempts
                      </p>
                      <p className="text-sm font-bold text-[#B80B3D]">
                        Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, '0')}
                      </p>
                    </motion.div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

            {/* Footer Info - only on login step, not OTP */}
            {step === 1 && (
              <div className="mt-6 text-center">
                <p className="text-[11px] text-gray-400/80 font-medium leading-relaxed max-w-[320px] mx-auto">
                  By continuing, you agree to our <br />
                  <Link to="/user/profile/terms" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-[#B80B3D] transition-colors uppercase tracking-wider font-semibold">TERMS</Link>
                  <span className="mx-2 text-gray-400/80 font-bold">•</span>
                  <Link to="/user/profile/privacy" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-[#B80B3D] transition-colors uppercase tracking-wider font-semibold">PRIVACY</Link>
                  <span className="mx-2 text-gray-400/80 font-bold">•</span>
                  <Link to="/user/profile/support-info" state={{ from: "/user/auth/login" }} className="text-gray-400 hover:text-[#B80B3D] transition-colors uppercase tracking-wider font-semibold">SUPPORT</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name Collection Modal */}
      <Dialog
        open={showNameModal}
        onOpenChange={(open) => {
          // Prevent closing on backdrop click or escape key
          if (!open) return;
          setShowNameModal(true);
        }}
      >
        <DialogContent
          className="sm:max-w-[425px] rounded-3xl border-none p-0 overflow-hidden bg-white dark:bg-[#1a1a1a]"
          showCloseButton={false}
        >
          <div className="bg-gradient-to-br from-[#B80B3D] to-[#66001D] p-8 text-center relative">
            <button
              onClick={handleEditNumber}
              className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all active:scale-95 z-20"
              aria-label="Close and return to login"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            <DialogTitle className="text-2xl font-bold text-white mb-2">Almost there!</DialogTitle>
            <DialogDescription className="text-white/80">
              We'd love to know your name to personalize your experience.
            </DialogDescription>
          </div>

          <form onSubmit={handleNameSubmit} className="p-8 pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                Full Name
              </Label>
              <div className="relative group">
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => {
                    const filteredValue = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                    setNewName(filteredValue);
                  }}
                  placeholder="Enter your name"
                  className="pl-4 h-14 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#B80B3D] transition-all group-hover:border-[#B80B3D]/30"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isUpdatingName}
                className="w-full h-14 bg-gradient-to-r from-[#B80B3D] to-[#66001D] hover:from-[#90082E] hover:to-[#4A0014] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#B80B3D]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Complete Profile"
                )}
              </Button>
              {!pendingVerify ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false)
                    navigate("/food/user", { replace: true })
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                >
                  Skip for now
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center">Name is required to complete signup.</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restore/New Account Popup */}
      <AnimatePresence>
        {showRestorePopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            // Removed onClick to prevent closing on backdrop click
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
                onClick={handleEditNumber}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 transition-all active:scale-95"
                aria-label="Close and return to login"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone className="h-10 w-10 text-[#DC2626]" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Account Found!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                A deleted account for <span className="font-bold text-gray-900 dark:text-white">+91 {phoneNumber}</span> was found.
                Do you want to restore your old data or start fresh with a new account?
              </p>

              <div className="space-y-4">
                <button
                  onClick={async () => {
                    await processVerify(phoneNumber, otp, "restore");
                    setShowRestorePopup(false);
                  }}
                  className="w-full h-14 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded-2xl shadow-xl shadow-[#DC2626]/20 transition-all active:scale-[0.98]"
                >
                  Restore My Account
                </button>
                <button
                  onClick={async () => {
                    await processVerify(phoneNumber, otp, "new");
                    setShowRestorePopup(false);
                  }}
                  className="w-full h-14 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98]"
                >
                  Create New Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
