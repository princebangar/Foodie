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

// Slides are 1080 x 1350 (4:5), shown full width with the sheet right below.
const SLIDER_ASPECT = 1350 / 1080
// Zomato's slider ends at 1348 of 2400 px (56%) of the screen. Taking the same
// share of the page keeps the form where Zomato has it, even under a browser bar.
const SLIDER_SCREEN_SHARE = 0.56
// Room the form always keeps on short screens; the slider shrinks instead.
const SHEET_MIN_HEIGHT = 236

// Measured from the Zomato login screen (1080 px wide at 2.75 px per dp).
const LOGIN_FONT = "'Lexend', 'Figtree', sans-serif"
const FIELD_CLASS =
  "h-12 rounded-lg border border-[#D0D4DC] bg-white shadow-[0_1px_2px_rgba(28,28,28,0.12)] dark:border-gray-700 dark:bg-gray-900"
const PRIMARY_BUTTON_CLASS =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#EF4F5F] text-[20px] font-normal text-white transition-colors active:bg-[#E23744]"

function IndiaFlag() {
  return (
    <svg viewBox="0 0 30 20" preserveAspectRatio="none" className="h-[15px] w-[23px] rounded-[3px]" role="img" aria-label="India">
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
    width: window.innerWidth,
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
        width: window.innerWidth,
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

  const primaryColor = "#DC2626" // Rebranded Red color

  // The page column is capped at 480px from md up (md:max-w-[480px] below).
  const columnWidth = viewport.width >= 768 ? Math.min(viewport.width, 480) : viewport.width
  // Like Zomato: with the keyboard up the form sits right above the keys and
  // the terms line stays hidden behind them.
  const keyboardOpen = viewport.baseHeight - viewport.height > 120
  const sliderHeight = Math.max(
    Math.min(
      Math.round(columnWidth * SLIDER_ASPECT),
      Math.round(viewport.baseHeight * SLIDER_SCREEN_SHARE),
      viewport.baseHeight - SHEET_MIN_HEIGHT
    ),
    0
  )

  return (
    <div
      className="fixed inset-x-0 flex justify-center overflow-hidden bg-black"
      style={{ top: viewport.top, height: viewport.height, fontFamily: LOGIN_FONT }}
    >
      <div className="relative h-full w-full md:max-w-[480px]">
        <LoginImageSlider
          slider={slider}
          height={sliderHeight}
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

        {/* Bottom sheet */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col">
          <div className="pb-2.5">
            <LoginSliderDots count={slider.images.length} activeIndex={slider.index} />
          </div>

          <div
            className="flex flex-col overflow-y-auto bg-white px-4 pt-4 min-[360px]:px-6 dark:bg-[#0a0a0a]"
            style={{
              paddingBottom: keyboardOpen ? 16 : "calc(env(safe-area-inset-bottom, 0px) + 20px)",
              // Fills the screen below the slider; with the keyboard up the sheet
              // shrinks to its content and rides over the slider's bottom.
              minHeight: keyboardOpen ? 0 : Math.max(viewport.height - sliderHeight, 0),
            }}
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
                  <h1 className="mb-4 text-center text-[16px] font-medium leading-[23px] text-[#596378] dark:text-gray-300">
                    Log in or sign up
                  </h1>

                  <div className="flex gap-2.5">
                    <div className={`${FIELD_CLASS} flex w-[66px] shrink-0 items-center justify-center`}>
                      <IndiaFlag />
                    </div>
                    <label className={`${FIELD_CLASS} flex min-w-0 flex-1 items-center gap-1.5 px-4`}>
                      <span className="text-[18px] font-normal text-[#1C1C1C] dark:text-white">+91</span>
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
                        className="w-full min-w-0 bg-transparent text-[18px] font-normal text-[#1C1C1C] caret-[#E23744] outline-none placeholder:text-[16px] placeholder:text-[#AFB4C0] min-[360px]:placeholder:text-[18px] dark:text-white"
                        placeholder="Enter Phone Number"
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
                    className={`${PRIMARY_BUTTON_CLASS} mt-5`}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
                  </button>
                </motion.form>
              ) : null}
            </AnimatePresence>

            {/* Footer Info - only on login step, not OTP */}
            {step === 1 && !keyboardOpen && (
              // Pinned to the bottom of the sheet, like the Zomato terms line.
              <div className="mt-auto pt-8 text-center text-[14px] font-normal leading-[20px] text-[#414A5D] dark:text-gray-400">
                <p>By continuing, you agree to our</p>
                <p className="mt-0.5 flex justify-center gap-3">
                  {[
                    { to: "/user/profile/terms", label: "Terms of Service" },
                    { to: "/user/profile/privacy", label: "Privacy Policy" },
                    { to: "/user/profile/support-info", label: "Support" },
                  ].map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      state={{ from: "/user/auth/login" }}
                      className="border-b border-dotted border-[#9CA3AF] pb-px"
                    >
                      {label}
                    </Link>
                  ))}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* OTP page: full white screen with its own header, like Zomato's. */}
        <AnimatePresence>
          {step === 2 && (
            <motion.form
              key="otp-page"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onSubmit={handleVerifyOTP}
              noValidate
              className="absolute inset-0 z-20 flex flex-col bg-white text-[#1C1C1C] dark:bg-[#0a0a0a] dark:text-white"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            >
              <div className="flex h-14 shrink-0 items-center">
                <button
                  type="button"
                  onClick={handleEditNumber}
                  aria-label="Go back and change number"
                  className="ml-2.5 rounded-full p-1.5 active:bg-gray-100 dark:active:bg-gray-800"
                >
                  <ArrowLeft className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <h1 className="ml-1.5 text-[24px] font-normal leading-none">OTP Verification</h1>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
                <p className="mt-6 text-center text-[16px] leading-[23px]">
                  We have sent a verification code to
                </p>
                <p className="mt-1.5 text-center text-[16px] font-semibold leading-[23px]">
                  +91-{phoneNumber}
                </p>

                <div className="mt-11 flex justify-center gap-[17px]">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="tel"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1} of the OTP`}
                      disabled={loading || blockTimer > 0}
                      autoFocus={index === 0}
                      value={otp[index] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(-1)
                        if (!val) return
                        setOtpError("")
                        const newOtp = otp.split("")
                        newOtp[index] = val
                        const combined = newOtp.join("").slice(0, 4)
                        setOtp(combined)
                        if (index < 3) {
                          document.getElementById(`otp-${index + 1}`)?.focus()
                        } else if (combined.length === 4) {
                          // No button: like Zomato, the last digit sends the code.
                          handleVerifyOTP(null, combined)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Backspace") return
                        if (!otp[index] && index > 0) {
                          document.getElementById(`otp-${index - 1}`)?.focus()
                        } else {
                          const newOtp = otp.split("")
                          newOtp[index] = ""
                          setOtp(newOtp.join(""))
                        }
                      }}
                      className={`h-12 w-[43px] rounded-[7px] border bg-white text-center text-[20px] font-medium text-[#1C1C1C] caret-[#E23744] outline-none focus:border-[#1C1C1C] focus:shadow-[0_0_0_1px_#1C1C1C] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white ${otpError ? "border-[#E23744]" : "border-[#D0D4DC]"}`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p role="alert" className="mt-3 text-center text-[14px] text-[#E23744]">
                    {otpError}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-center gap-1.5 text-[16px] font-medium">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#9197A6]" />
                      <span className="text-[#9197A6]">Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Didn't get the OTP?</span>
                      {blockTimer > 0 ? (
                        <span className="text-[#9197A6]">Resend SMS</span>
                      ) : resendTimer > 0 ? (
                        <span className="text-[#9197A6]">Resend SMS in {resendTimer}s</span>
                      ) : (
                        <button type="button" onClick={handleResendOTP} className="text-[#EF4F5F]">
                          Resend SMS
                        </button>
                      )}
                    </>
                  )}
                </div>

                {blockTimer > 0 && (
                  <div className="mx-auto mt-5 w-fit rounded-lg border border-red-100 bg-red-50 px-5 py-2.5 text-center dark:border-red-900/50 dark:bg-red-950/20">
                    <p className="text-[12px] font-medium uppercase tracking-wider text-[#E23744]">
                      Too many failed attempts
                    </p>
                    <p className="text-[14px] font-medium text-[#E23744]">
                      Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, "0")}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEditNumber}
                  className="mx-auto mt-auto shrink-0 pt-10 text-[16px] text-[#EF4F5F]"
                  style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}
                >
                  Go back to login methods
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
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
