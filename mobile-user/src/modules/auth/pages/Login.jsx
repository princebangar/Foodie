// Web: modules/auth/pages/Login.jsx — the customer login at /user/auth/login (UnifiedOTPFastLogin): the admin login
// images slider on top, a white sheet with "Log in or sign up" (+91 number, Continue, "Continue as Guest" - the
// web's "Skip" pill, moved under Continue) and the legal links, then the OTP page sliding in from the right (4 boxes, resend timer, block timer), the "Almost there!" name
// popup for new users and the "Account Found!" restore popup for a deleted account. Same API calls and session
// restore (sessionStorage user_auth_session_data).
// Native: the sheet rides on the keyboard (the slider keeps its size); Android Back on the OTP page goes back to the
// number (web: popstate), on the number step it leaves the app (LoginExitGuard). The FCM token is the native one.
// The web's Lexend font is not bundled: the app's default font is used.
import React, { useEffect, useRef, useState } from "react"
import { Animated, BackHandler, Easing, Keyboard, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import Svg, { Circle, Line, Rect } from "react-native-svg"
import { ArrowLeft, Phone, Loader2, X, User } from "lucide-react-native"
import { Link, useNavigate } from "@/lib/router"
import { toast } from "@/lib/toast"
import { Text, TextInput } from "@/native/ui"
import { StatusBar } from "@/native/ui/SectionStatusBar"
import { LoginExitGuard } from "@/native/ui/LoginExitGuard"
import { Spin } from "@/shared/components/Loader"
import { alpha, colors, makeStyles, useLightWindowBackground, useTheme } from "@/theme"
import useKeyboardOffset from "@/modules/Taxi/shared/hooks/useKeyboardOffset"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import { LoginImageSlider, LoginSliderDots, useLoginImageSlider } from "../components/LoginImageSlider"

const SLIDER_ASPECT = 1350 / 1080
const SLIDER_SCREEN_SHARE = 0.52 // web 0.56: the sheet also holds "Continue as Guest" now
const SHEET_MIN_HEIGHT = 330 // small phones: the banner gives way so the sheet (with the guest button) fits
const RED = "#E23744"

function IndiaFlag() {
  return (
    <Svg viewBox="0 0 30 20" preserveAspectRatio="none" width={23} height={15} style={{ borderRadius: 3 }}>
      <Rect width="30" height="6.67" fill="#FF9933" />
      <Rect y="6.67" width="30" height="6.66" fill="#FFFFFF" />
      <Rect y="13.33" width="30" height="6.67" fill="#138808" />
      <Circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.5" />
      <Circle cx="15" cy="10" r="0.5" fill="#000080" />
      {Array.from({ length: 12 }, (_, spoke) => (
        <Line key={spoke} x1="15" y1="10" x2="15" y2="7.4" stroke="#000080" strokeWidth="0.25" rotation={spoke * 30} origin="15, 10" />
      ))}
    </Svg>
  )
}

function Spinner({ size = 20, color = colors.white }) {
  return (
    <Spin>
      <Loader2 size={size} color={color} />
    </Spin>
  )
}

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 59
  const ENV = globalThis.__ENV__ || {}
  const defaultTestPhone =
    ENV.VITE_USE_DEFAULT_TEST_PHONE === "true" ? String(ENV.VITE_DEFAULT_TEST_PHONE || "").replace(/\D/g, "").slice(0, 10) : ""
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
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const keyboard = useKeyboardOffset()
  const s = useStyles()
  const t = useTheme()
  const submitting = useRef(false)
  const otpRefs = useRef([])
  const otpSlide = useRef(new Animated.Value(winW)).current
  // the keyboard opening/closing shows the window behind the page for a moment: keep it white like this page
  useLightWindowBackground()

  const SESSION_KEY = "user_auth_session_data"

  // Restore the login state after the app was sent to the background (web: reload)
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber)
        if (parsed.step) setStep(parsed.step)
        if (parsed.showNameModal !== undefined) setShowNameModal(parsed.showNameModal)
        if (parsed.newName) setNewName(parsed.newName)
        if (parsed.tempAuth) setTempAuth(parsed.tempAuth)
        if (parsed.pendingVerify) setPendingVerify(parsed.pendingVerify)
        if (parsed.showRestorePopup !== undefined) setShowRestorePopup(parsed.showRestorePopup)
        if (parsed.deletedAccountData) setDeletedAccountData(parsed.deletedAccountData)
        if (parsed.resendExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.resendExpiresAt - Date.now()) / 1000))
          if (remaining > 0) setResendTimer(remaining)
        }
        if (parsed.blockExpiresAt) {
          const remaining = Math.max(0, Math.floor((parsed.blockExpiresAt - Date.now()) / 1000))
          if (remaining > 0) {
            setBlockTimer(remaining)
            if (parsed.step === 1) setStep(2)
          }
        }
      } catch (e) {
        console.error("Failed to rehydrate login state", e)
      }
    }
  }, [])

  useEffect(() => {
    if (step === 1 && !phoneNumber && !blockTimer && !showNameModal && !showRestorePopup) return
    const stateToSave = {
      phoneNumber,
      step,
      showNameModal,
      newName,
      tempAuth,
      pendingVerify,
      showRestorePopup,
      deletedAccountData,
      resendExpiresAt: resendTimer > 0 ? Date.now() + resendTimer * 1000 : null,
      blockExpiresAt: blockTimer > 0 ? Date.now() + blockTimer * 1000 : null,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber, step, showNameModal, newName, tempAuth, pendingVerify, showRestorePopup, deletedAccountData, resendTimer === 0, blockTimer === 0])

  const clearSessionData = () => sessionStorage.removeItem(SESSION_KEY)

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const blockSecondsFrom = (msg) => {
    const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
    if (!timeMatch) return 180
    return parseInt(timeMatch[1], 10) * 60 + (timeMatch[2] ? parseInt(timeMatch[2], 10) : 0)
  }

  const handleSendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      setPhoneError("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
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
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send OTP."
      const lowerMsg = msg.toLowerCase()
      if (lowerMsg.includes("blocked") || lowerMsg.includes("too many attempts") || lowerMsg.includes("try again after")) {
        setBlockTimer(blockSecondsFrom(msg))
        setStep(2)
        return
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
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to resend OTP."
      const lowerMsg = msg.toLowerCase()
      if (lowerMsg.includes("blocked") || lowerMsg.includes("too many attempts") || lowerMsg.includes("try again after")) {
        setBlockTimer(blockSecondsFrom(msg))
        return
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const backToNumber = () => {
    setShowNameModal(false)
    setShowRestorePopup(false)
    setDeletedAccountData(null)
    setPendingVerify(null)
    setBlockTimer(0)
    setOtpError("")
    setOtp("")
    setStep(1)
    setResendTimer(0)
  }
  const handleEditNumber = backToNumber

  const processVerify = async (phone, otpCode, confirmAction = null) => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    // web: inside the app shell the FCM token came from the Flutter bridge (platform "mobile")
    const fcmToken = globalThis.__nativeFcmToken || null
    const platform = "mobile"
    try {
      const response = await authAPI.verifyOTP(phone, otpCode, "login", null, null, "user", null, null, fcmToken, platform, null, confirmAction)
      const data = response?.data?.data || response?.data || {}

      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setLoading(false)
        submitting.current = false
        return
      }

      if (data.needsName) {
        setShowRestorePopup(false)
        setPendingVerify({ phone: phoneNumber, otp: otpCode, fcmToken, platform, confirmAction })
        setShowNameModal(true)
        setLoading(false)
        submitting.current = false
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user
      if (!accessToken || !user) throw new Error("Invalid parameters from server")

      setAuthData("user", accessToken, user, refreshToken)

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
      setOtp("")
      setTimeout(() => otpRefs.current[0]?.focus(), 50)

      if (msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("too many attempts")) {
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/)
        if (timeMatch) {
          setBlockTimer(parseInt(timeMatch[1], 10) * 60 + (timeMatch[2] ? parseInt(timeMatch[2], 10) : 0))
          msg = ""
        }
      }

      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setShowRestorePopup(false)
        setPendingVerify({ phone: phoneNumber, otp: otpCode, fcmToken, platform, confirmAction })
        setShowNameModal(true)
        return
      }

      if (status === 401 && msg) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          toast.error("Your account is deactivated. Please contact support.")
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

  const handleVerifyOTP = async (customOtp = null) => {
    const code = typeof customOtp === "string" ? customOtp : otp
    const otpDigits = String(code).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    await processVerify(phoneNumber, otpDigits)
  }

  const handleNameSubmit = async () => {
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
          null,
          pendingVerify.confirmAction,
        )
        const data = response?.data?.data || response?.data || {}
        setAuthData("user", data.accessToken, data.user, data.refreshToken || null)
        setPendingVerify(null)
        clearSessionData()
        setShowNameModal(false)
        navigate("/food/user", { replace: true })
        return
      }
      await userAPI.updateProfile({ name: newName.trim() })
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
    if (step !== 2 || resendTimer <= 0) return undefined
    const intervalId = setInterval(() => setResendTimer((prev) => (prev > 0 ? prev - 1 : 0)), 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return undefined
    const intervalId = setInterval(() => setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0)), 1000)
    return () => clearInterval(intervalId)
  }, [blockTimer])

  // OTP page slides in from the right (0.25 s, ease [0.32, 0.72, 0, 1]); the first box gets the focus
  useEffect(() => {
    Animated.timing(otpSlide, { toValue: step === 2 ? 0 : winW, duration: 250, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }).start()
    if (step === 2) {
      const id = setTimeout(() => otpRefs.current[0]?.focus(), 260)
      return () => clearTimeout(id)
    }
    return undefined
  }, [step, otpSlide, winW])

  // Back on the OTP page goes back to the number (web: popstate); blocked -> stays
  useEffect(() => {
    if (step !== 2) return undefined
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (blockTimer > 0) return true
      setShowNameModal(false)
      setShowRestorePopup(false)
      setDeletedAccountData(null)
      setPendingVerify(null)
      setNewName("")
      setStep(1)
      setOtp("")
      setOtpError("")
      setResendTimer(0)
      return true
    })
    return () => sub.remove()
  }, [step, blockTimer])

  const keyboardOpen = keyboard > 120
  const sliderHeight = Math.max(
    Math.min(Math.round(winW * SLIDER_ASPECT), Math.round(winH * SLIDER_SCREEN_SHARE), winH - SHEET_MIN_HEIGHT),
    0,
  )

  const onOtpChange = (index, text) => {
    const digits = String(text || "").replace(/\D/g, "")
    if (!digits) {
      const next = otp.split("")
      next[index] = ""
      setOtp(next.join(""))
      return
    }
    setOtpError("")
    const retyped = digits.length === 2 && otp[index] && digits.includes(otp[index])
    if (digits.length > 1 && !retyped) {
      const prev = otp.split("")
      digits.split("").forEach((d, i) => {
        if (index + i < 4) prev[index + i] = d
      })
      const combined = prev.join("").slice(0, 4)
      setOtp(combined)
      otpRefs.current[Math.min(index + digits.length, 3)]?.focus()
      if (combined.length === 4) handleVerifyOTP(combined)
      return
    }
    const val = retyped ? (digits[0] === otp[index] ? digits[1] : digits[0]) : digits
    const newOtp = otp.split("")
    newOtp[index] = val
    const combined = newOtp.join("").slice(0, 4)
    setOtp(combined)
    if (index < 3) otpRefs.current[index + 1]?.focus()
    else if (combined.length === 4) handleVerifyOTP(combined)
  }

  const onOtpKey = (index, e) => {
    if (e.nativeEvent.key !== "Backspace") return
    if (!otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    } else {
      const newOtp = otp.split("")
      newOtp[index] = ""
      setOtp(newOtp.join(""))
    }
  }

  return (
    // a tap anywhere outside the number box (the banner, the sheet) closes the keyboard and takes the focus away
    <Pressable style={s.root} onPress={Keyboard.dismiss} accessible={false}>
      <StatusBar style="light" />
      <LoginExitGuard enabled={step === 1} dirty={phoneNumber.length > 0} accent={RED} />
      <LoginImageSlider slider={slider} height={sliderHeight} />

      {/* Bottom sheet */}
      <View style={[s.sheetWrap, { bottom: keyboard }]}>
        <View style={{ paddingBottom: 10 }}>
          <LoginSliderDots count={slider.images.length} activeIndex={slider.index} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          contentContainerStyle={[
            s.sheet,
            {
              paddingBottom: keyboardOpen ? 16 : insets.bottom + 20,
              minHeight: keyboardOpen ? 0 : Math.max(winH - sliderHeight, 0),
            },
          ]}
        >
          <Text style={s.title}>Log in or sign up</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.field, { width: 66, alignItems: "center", justifyContent: "center" }]}>
              <IndiaFlag />
            </View>
            <View style={[s.field, { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16 }]}>
              <Text style={s.prefix}>+91</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={(v) => {
                  setPhoneNumber(String(v || "").replace(/\D/g, "").slice(0, 10))
                  setPhoneError("")
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={10}
                placeholder="Enter Phone Number"
                placeholderTextColor="#AFB4C0"
                cursorColor={RED}
                selectionColor={alpha(RED, 0.3)}
                accessibilityLabel="Mobile number"
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
                style={s.phoneInput}
              />
            </View>
          </View>
          {phoneError ? <Text style={s.phoneError}>{phoneError}</Text> : null}
          <Pressable onPress={handleSendOTP} disabled={loading} style={({ pressed }) => [s.primary, { marginTop: 20 }, pressed && { backgroundColor: "#CB202D" }]}>
            {loading && step === 1 ? <Spinner /> : <Text style={s.primaryText}>Continue</Text>}
          </Pressable>
          {/* guest entry (web: the "Skip" pill over the banner, moved here - on the phone it covered the banner's heading) */}
          {blockTimer <= 0 && (
            <Pressable
              onPress={() => {
                localStorage.setItem("user_authenticated", "false")
                clearSessionData()
                navigate("/food/user")
              }}
              style={({ pressed }) => [s.guest, pressed && { backgroundColor: alpha(RED, 0.08) }]}
            >
              <Text style={s.guestText}>Continue as Guest</Text>
            </Pressable>
          )}

          {/* Footer Info - only on login step, not OTP */}
          {!keyboardOpen && (
            <View style={{ marginTop: "auto", paddingTop: 32, alignItems: "center" }}>
              <Text style={s.legal}>By continuing, you agree to our</Text>
              <View style={{ marginTop: 2, flexDirection: "row", justifyContent: "center", gap: 12 }}>
                {[
                  { to: "/user/profile/terms", label: "Terms of Service" },
                  { to: "/user/profile/privacy", label: "Privacy Policy" },
                  { to: "/user/profile/support-info", label: "Support" },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} state={{ from: "/user/auth/login" }} style={s.legalLink}>
                    <Text style={s.legal}>{label}</Text>
                  </Link>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* OTP page: full white screen with its own header */}
      <Animated.View pointerEvents={step === 2 ? "auto" : "none"} style={[s.otpPage, { paddingTop: insets.top, transform: [{ translateX: otpSlide }] }]}>
        {step === 2 && <StatusBar style={t.dark ? "light" : "dark"} />}
        <View style={{ height: 56, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={handleEditNumber} accessibilityLabel="Go back and change number" style={({ pressed }) => [{ marginLeft: 10, borderRadius: 9999, padding: 6 }, pressed && { backgroundColor: t.dark ? colors.gray[800] : colors.gray[100] }]}>
            <ArrowLeft size={24} color={t.dark ? colors.white : "#1C1C1C"} strokeWidth={1.75} />
          </Pressable>
          <Text style={s.otpHeader}>OTP Verification</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: keyboard }}>
          <Text style={[s.otpText, { marginTop: 24 }]}>We have sent a verification code to</Text>
          <Text style={[s.otpText, { marginTop: 6, fontWeight: "600" }]}>+91-{phoneNumber}</Text>

          <View style={{ marginTop: 44, flexDirection: "row", justifyContent: "center", gap: 17 }}>
            {[0, 1, 2, 3].map((index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  otpRefs.current[index] = el
                }}
                value={otp[index] || ""}
                onChangeText={(v) => onOtpChange(index, v)}
                onKeyPress={(e) => onOtpKey(index, e)}
                keyboardType="number-pad"
                autoComplete={index === 0 ? "sms-otp" : "off"}
                textContentType={index === 0 ? "oneTimeCode" : "none"}
                accessibilityLabel={`Digit ${index + 1} of the OTP`}
                editable={!(loading || blockTimer > 0)}
                maxLength={index === 0 ? 4 : 2}
                cursorColor={RED}
                selectTextOnFocus
                style={[s.otpBox, (loading || blockTimer > 0) && { opacity: 0.6 }]}
              />
            ))}
          </View>

          {otpError ? <Text style={s.otpError}>{otpError}</Text> : null}

          <View style={{ marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {loading ? (
              <>
                <Spinner size={16} color="#9197A6" />
                <Text style={[s.resendText, { color: "#9197A6" }]}>Verifying...</Text>
              </>
            ) : (
              <>
                <Text style={s.resendText}>Didn't get the OTP?</Text>
                {blockTimer > 0 ? (
                  <Text style={[s.resendText, { color: "#9197A6" }]}>Resend SMS</Text>
                ) : resendTimer > 0 ? (
                  <Text style={[s.resendText, { color: "#9197A6" }]}>Resend SMS in {resendTimer}s</Text>
                ) : (
                  <Pressable onPress={handleResendOTP}>
                    <Text style={[s.resendText, { color: RED }]}>Resend SMS</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {blockTimer > 0 && (
            <View style={s.blockBox}>
              <Text style={s.blockTitle}>Too many failed attempts</Text>
              <Text style={s.blockText}>
                Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, "0")}
              </Text>
            </View>
          )}

          <Pressable onPress={handleEditNumber} style={{ alignSelf: "center", marginTop: "auto", paddingTop: 40, marginBottom: insets.bottom + 88 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, color: RED }}>Go back to login methods</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      {/* Name Collection Modal */}
      <Modal visible={showNameModal} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => {}}>
        <View style={[s.modalBackdrop, { paddingBottom: keyboard }]}>
          <View style={s.nameCard}>
            <LinearGradient colors={["#B80B3D", "#66001D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.nameHead}>
              <View style={s.nameGlow} />
              <Pressable onPress={handleEditNumber} accessibilityLabel="Close and return to login" style={s.nameClose}>
                <X size={20} color={colors.white} />
              </Pressable>
              <View style={s.nameIcon}>
                <User size={40} color={colors.white} />
              </View>
              <Text style={s.nameTitle}>Almost there!</Text>
              <Text style={s.nameDesc}>We'd love to know your name to personalize your experience.</Text>
            </LinearGradient>
            <View style={{ padding: 32, paddingTop: 24, gap: 24 }}>
              <View style={{ gap: 16 }}>
                <Text style={s.nameLabel}>Full Name</Text>
                <TextInput
                  value={newName}
                  onChangeText={(v) => setNewName(String(v || "").replace(/[^a-zA-Z\s]/g, ""))}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.gray[400]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNameSubmit}
                  style={s.nameInput}
                />
              </View>
              <View style={{ gap: 12 }}>
                <Pressable onPress={handleNameSubmit} disabled={isUpdatingName} style={({ pressed }) => [{ borderRadius: 16, overflow: "hidden" }, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <LinearGradient colors={["#B80B3D", "#66001D"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.nameSubmit}>
                    {isUpdatingName ? <Spinner /> : <Text style={s.nameSubmitText}>Complete Profile</Text>}
                  </LinearGradient>
                </Pressable>
                {!pendingVerify ? (
                  <Pressable
                    onPress={() => {
                      setShowNameModal(false)
                      navigate("/food/user", { replace: true })
                    }}
                    style={{ paddingVertical: 8, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 14, lineHeight: 20, color: colors.gray[400] }}>Skip for now</Text>
                  </Pressable>
                ) : (
                  <Text style={{ fontSize: 12, lineHeight: 16, color: colors.gray[400], textAlign: "center" }}>Name is required to complete signup.</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Restore/New Account Popup */}
      <Modal visible={showRestorePopup} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={handleEditNumber}>
        <View style={s.modalBackdrop}>
          <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.6) }]} />
          <View style={s.restoreCard}>
            <Pressable onPress={handleEditNumber} accessibilityLabel="Close and return to login" style={s.restoreClose}>
              <X size={20} color={colors.gray[400]} />
            </Pressable>
            <View style={s.restoreIcon}>
              <Phone size={40} color="#DC2626" />
            </View>
            <Text style={s.restoreTitle}>Account Found!</Text>
            <Text style={s.restoreText}>
              A deleted account for <Text style={{ fontWeight: "700", color: t.dark ? colors.white : colors.gray[900] }}>+91 {phoneNumber}</Text> was found. Do you want
              to restore your old data or start fresh with a new account?
            </Text>
            <View style={{ gap: 16 }}>
              <Pressable
                onPress={async () => {
                  await processVerify(phoneNumber, otp, "restore")
                  setShowRestorePopup(false)
                }}
                style={({ pressed }) => [s.restoreBtn, pressed && { backgroundColor: "#B91C1C" }]}
              >
                <Text style={s.restoreBtnText}>Restore My Account</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await processVerify(phoneNumber, otp, "new")
                  setShowRestorePopup(false)
                }}
                style={({ pressed }) => [s.newBtn, pressed && { backgroundColor: t.dark ? colors.gray[800] : colors.gray[50] }]}
              >
                <Text style={s.newBtnText}>Create New Account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  root: { flex: 1, backgroundColor: dark ? "#0a0a0a" : colors.white, overflow: "hidden" },
  sheetWrap: { position: "absolute", left: 0, right: 0, zIndex: 10, maxHeight: "100%" },
  sheet: { flexGrow: 1, backgroundColor: dark ? "#0a0a0a" : colors.white, paddingHorizontal: 24, paddingTop: 16 },
  title: { marginBottom: 16, textAlign: "center", fontSize: 16, lineHeight: 23, fontWeight: "500", color: dark ? colors.gray[300] : "#596378" },
  field: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: dark ? colors.gray[700] : "#D0D4DC",
    backgroundColor: dark ? colors.gray[900] : colors.white,
    elevation: 1,
    shadowColor: "#1C1C1C",
    shadowOpacity: 0.12,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  prefix: { fontSize: 18, color: dark ? colors.white : "#1C1C1C", includeFontPadding: false, textAlignVertical: "center" },
  // Android: a lineHeight on a TextInput puts the placeholder above the middle (it sat higher than "+91" and the flag);
  // no lineHeight + no font padding + vertical centring puts the text and the placeholder on the box's middle line
  phoneInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontSize: 18,
    color: dark ? colors.white : "#1C1C1C",
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  phoneError: { marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: "500", color: dark ? colors.red[500] : colors.red[600] },
  primary: { height: 52, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, backgroundColor: RED },
  primaryText: { fontSize: 20, lineHeight: 26, color: colors.white },
  guest: { marginTop: 12, height: 52, width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1.5, borderColor: RED },
  guestText: { fontSize: 18, lineHeight: 24, color: RED },
  legal: { textAlign: "center", fontSize: 14, lineHeight: 20, color: dark ? colors.gray[400] : "#414A5D" },
  legalLink: { borderBottomWidth: 1, borderStyle: "dotted", borderBottomColor: "#9CA3AF", paddingBottom: 1 },
  otpPage: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: dark ? "#0a0a0a" : colors.white },
  otpHeader: { marginLeft: 6, fontSize: 24, lineHeight: 28, color: dark ? colors.white : "#1C1C1C" },
  otpText: { textAlign: "center", fontSize: 16, lineHeight: 23, color: dark ? colors.white : "#1C1C1C" },
  otpBox: {
    height: 48,
    width: 43,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: dark ? colors.gray[700] : "#D0D4DC",
    backgroundColor: dark ? colors.gray[900] : colors.white,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "500",
    color: dark ? colors.white : "#1C1C1C",
    paddingVertical: 0,
  },
  otpError: { marginTop: 12, textAlign: "center", fontSize: 14, lineHeight: 20, color: RED },
  resendText: { fontSize: 16, lineHeight: 22, fontWeight: "500", color: dark ? colors.white : "#1C1C1C" },
  blockBox: {
    alignSelf: "center",
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: dark ? alpha(colors.red[900], 0.5) : colors.red[100],
    backgroundColor: dark ? alpha(colors.red[950], 0.2) : colors.red[50],
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
  },
  blockTitle: { fontSize: 12, lineHeight: 16, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.6, color: RED },
  blockText: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: RED },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: alpha("#000000", 0.5) },
  nameCard: { width: "100%", maxWidth: 425, borderRadius: 24, overflow: "hidden", backgroundColor: dark ? "#1a1a1a" : colors.white },
  nameHead: { padding: 32, alignItems: "center", overflow: "hidden" },
  nameGlow: { position: "absolute", top: -30, right: -30, width: 128, height: 128, borderRadius: 9999, backgroundColor: alpha("#ffffff", 0.1) },
  nameClose: { position: "absolute", top: 16, right: 16, padding: 8, borderRadius: 12, backgroundColor: alpha("#ffffff", 0.2), zIndex: 20 },
  nameIcon: { width: 80, height: 80, borderRadius: 9999, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: alpha("#ffffff", 0.2), borderWidth: 1, borderColor: alpha("#ffffff", 0.3) },
  nameTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.white, marginBottom: 8 },
  nameDesc: { fontSize: 14, lineHeight: 20, color: alpha("#ffffff", 0.8), textAlign: "center" },
  nameLabel: { marginLeft: 4, fontSize: 14, lineHeight: 20, fontWeight: "500", color: dark ? colors.gray[300] : colors.gray[700] },
  nameInput: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dark ? colors.gray[700] : colors.gray[100],
    backgroundColor: dark ? colors.gray[800] : colors.gray[50],
    fontSize: 16,
    color: dark ? colors.white : colors.gray[900],
  },
  nameSubmit: { height: 56, alignItems: "center", justifyContent: "center" },
  nameSubmitText: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.white },
  restoreCard: {
    width: "100%",
    maxWidth: 384,
    borderRadius: 24,
    padding: 32,
    alignItems: "stretch",
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    borderWidth: 1,
    borderColor: dark ? colors.gray[800] : colors.gray[100],
    elevation: 24,
  },
  restoreClose: { position: "absolute", top: 16, right: 16, padding: 8, borderRadius: 12, zIndex: 2 },
  restoreIcon: { alignSelf: "center", width: 80, height: 80, borderRadius: 9999, alignItems: "center", justifyContent: "center", marginBottom: 24, backgroundColor: alpha("#DC2626", 0.1) },
  restoreTitle: { textAlign: "center", fontSize: 24, lineHeight: 32, fontWeight: "700", color: dark ? colors.white : colors.gray[900], marginBottom: 12 },
  restoreText: { textAlign: "center", fontSize: 16, lineHeight: 26, color: dark ? colors.gray[400] : colors.gray[500], marginBottom: 32 },
  restoreBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#DC2626" },
  restoreBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
  newBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: dark ? colors.gray[800] : colors.gray[200] },
  newBtnText: { fontSize: 16, fontWeight: "700", color: dark ? colors.gray[300] : colors.gray[700] },
}))
