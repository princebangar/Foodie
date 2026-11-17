// Web: modules/Food/pages/user/auth/OTP.jsx — /food/user/auth/otp: the older OTP page that reads the number from
// sessionStorage "userAuthData" (no stored data -> /user/auth/login; already signed in -> /food/user). One hidden
// 4-digit input drawn as 4 boxes, resend timer, "Help us know you better" name step for new users and the deleted
// account restore popup. Same API calls. The FCM token is the native one (platform "mobile").
import React, { useEffect, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"
import { ArrowLeft, Loader2, Smartphone, AlertCircle } from "lucide-react-native"
import { useNavigate } from "@/lib/router"
import { Text, TextInput } from "@/native/ui"
import { Spin } from "@/shared/components/Loader"
import { alpha, brand, colors, makeStyles, useTheme } from "@/theme"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { authAPI } from "@food/api"
import { setAuthData as setUserAuthData } from "@food/utils/auth"

const PRIMARY = brand.primary

export default function OTP() {
  const navigate = useNavigate()
  const insets = useSafeAreaInsets()
  const s = useStyles()
  const t = useTheme()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("mobile")
  const [showRestorePopup, setShowRestorePopup] = useState(false)
  const [, setDeletedAccountData] = useState(null)
  const inputRef = useRef(null)
  const submittingRef = useRef(false)
  const timerRef = useRef(null)

  const startResendTimer = () => {
    setResendTimer(60)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (localStorage.getItem("user_authenticated") === "true") {
      navigate("/food/user", { replace: true })
      return undefined
    }
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      navigate("/user/auth/login", { replace: true })
      return undefined
    }
    const data = JSON.parse(stored)
    setAuthData(data)
    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      setContactInfo(phoneMatch ? `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}` : data.phone || "")
    }
    startResendTimer()
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  useEffect(() => {
    if (showNameInput) return undefined
    const timer = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [showNameInput])

  const handleVerify = async (otpValue = null, confirmAction = null) => {
    if (showNameInput && !confirmAction) return
    if (submittingRef.current) return
    const code4 = (otpValue || otp.join("")).replace(/\D/g, "").slice(0, 4)
    if (code4.length !== 4) {
      setError("OTP must be exactly 4 digits")
      return
    }
    submittingRef.current = true
    setIsLoading(true)
    setError("")
    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      const referralCode = authData?.referralCode || null
      const fcmToken = globalThis.__nativeFcmToken || null
      const platform = "mobile"
      setDeviceToken(fcmToken)
      setActivePlatform(platform)

      const response = await authAPI.verifyOTP(phone, code4, purpose, providedName, email, "user", null, referralCode, fcmToken, platform, null, confirmAction)
      const data = response?.data?.data || response?.data || {}

      if (data.deletedAccountFound) {
        setDeletedAccountData(data)
        setShowRestorePopup(true)
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user
      if (!accessToken || !user) throw new Error("Invalid response from server")
      if (!refreshToken) throw new Error("Invalid response from server: missing refresh token")

      const hasName = user.name && String(user.name).trim().length > 0 && String(user.name).toLowerCase() !== "null"
      if (data.isNewUser === true || !hasName) {
        setVerifiedOtp(code4)
        setShowNameInput(true)
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      sessionStorage.removeItem("userAuthData")
      setUserAuthData("user", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("userLoginSuccess"))
      setSuccess(true)
      setTimeout(() => navigate("/food/user"), 500)
    } catch (err) {
      const status = err?.response?.status
      let message = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to verify OTP. Please try again."
      if (status === 401) {
        message = /deactivat(ed|e)/i.test(String(message)) ? "Your account is deactivated. Please contact support." : "Invalid or expired code, or account not active."
      }
      setError(message)
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const handleSingleInputChange = (text) => {
    let val = String(text || "").replace(/\D/g, "")
    if (val.length > 4) val = val.slice(0, 4)
    if (val.length > 0) setError("")
    const newOtp = ["", "", "", ""]
    for (let i = 0; i < val.length; i++) newOtp[i] = val[i]
    setOtp(newOtp)
    if (!showNameInput && val.length === 4) handleVerify(val)
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }
    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }
    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }
    setIsLoading(true)
    setError("")
    setNameError("")
    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const referralCode = authData?.referralCode || null
      const response = await authAPI.verifyOTP(phone, verifiedOtp, purpose, trimmedName, email, "user", null, referralCode, deviceToken, activePlatform)
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user
      if (!accessToken || !user) throw new Error("Invalid response from server")
      if (!refreshToken) throw new Error("Invalid response from server: missing refresh token")
      sessionStorage.removeItem("userAuthData")
      setUserAuthData("user", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("userLoginSuccess"))
      setSuccess(true)
      setTimeout(() => navigate("/food/user"), 500)
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to complete registration. Please try again.")
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || isLoading) return
    setIsLoading(true)
    setError("")
    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      await authAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to resend OTP. Please try again.")
    } finally {
      setIsLoading(false)
    }
    startResendTimer()
    setOtp(["", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRef.current?.focus()
  }

  const handleRestoreAction = async (action) => {
    setShowRestorePopup(false)
    await handleVerify(otp.join(""), action)
  }

  if (!authData) return null

  const typed = otp.join("")

  return (
    <AnimatedPage style={s.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.center, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.card}>
          <View style={s.header}>
            <Pressable onPress={() => navigate("/food/user/auth/login")} accessibilityLabel="Go back" style={{ padding: 4, borderRadius: 9999 }}>
              <ArrowLeft size={20} color={t.dark ? colors.gray[300] : colors.gray[600]} />
            </Pressable>
            <Text style={s.headerTitle}>{showNameInput ? "Welcome!" : "OTP Verification"}</Text>
          </View>

          <View style={{ padding: 24, gap: 24 }}>
            <View style={{ alignItems: "center", gap: 16 }}>
              {showNameInput && (
                <View style={s.iconOuter}>
                  <View style={s.iconInner}>
                    <Smartphone size={20} color={colors.white} />
                  </View>
                </View>
              )}
              <View style={{ gap: 8, alignItems: "center" }}>
                <Text style={s.title}>{showNameInput ? "Help us know you better" : contactType === "email" ? "Verify your email" : "Verify your phone"}</Text>
                <Text style={s.sub}>
                  {showNameInput ? "We're excited to have you join us! Please tell us your full name to get started." : `We've sent a 4-digit code to ${contactInfo}`}
                </Text>
              </View>
            </View>

            {!showNameInput && (
              <View style={{ gap: 24 }}>
                <Pressable onPress={() => inputRef.current?.focus()} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <TextInput
                    ref={inputRef}
                    value={typed}
                    onChangeText={handleSingleInputChange}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!isLoading}
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    caretHidden
                    style={[StyleSheet.absoluteFill, { color: "transparent" }]}
                  />
                  {[0, 1, 2, 3].map((index) => (
                    <View
                      key={index}
                      pointerEvents="none"
                      style={[
                        s.box,
                        isLoading
                          ? { opacity: 0.5 }
                          : typed.length === index
                            ? { borderColor: PRIMARY }
                            : otp[index]
                              ? { borderColor: PRIMARY }
                              : null,
                      ]}
                    >
                      <Text style={s.boxText}>{otp[index]}</Text>
                    </View>
                  ))}
                </Pressable>

                {error ? (
                  <View style={s.errorBox}>
                    <AlertCircle size={14} color={colors.red[500]} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={s.resend}>
                  Didn't get the OTP?{" "}
                  {resendTimer > 0 ? (
                    <Text style={{ fontWeight: "500", color: t.dark ? colors.white : colors.gray[900] }}>Retry in {resendTimer}s</Text>
                  ) : (
                    <Text onPress={handleResend} style={{ fontWeight: "700", color: PRIMARY, opacity: isLoading ? 0.5 : 1 }}>
                      Resend SMS
                    </Text>
                  )}
                </Text>
              </View>
            )}

            {showNameInput && (
              <View style={{ gap: 24 }}>
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={name}
                    onChangeText={(v) => {
                      setName(v)
                      if (nameError) setNameError("")
                    }}
                    editable={!isLoading}
                    placeholder="Full Name"
                    placeholderTextColor={colors.gray[400]}
                    style={[s.nameInput, nameError && { borderColor: colors.red[500] }]}
                  />
                  {nameError ? <Text style={{ fontSize: 12, color: colors.red[500], paddingLeft: 4 }}>{nameError}</Text> : null}
                </View>
                <Button onPress={handleSubmitName} disabled={isLoading} style={s.finish} textStyle={{ color: colors.white, fontWeight: "700", fontSize: 18 }}>
                  {isLoading ? "Getting things ready..." : "Finish Registration"}
                </Button>
              </View>
            )}

            {isLoading && !showNameInput && (
              <View style={{ alignItems: "center", paddingTop: 8 }}>
                <Spin>
                  <Loader2 size={24} color={PRIMARY} />
                </Spin>
              </View>
            )}
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Foodie Food Delivery</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showRestorePopup} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setShowRestorePopup(false)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
          <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.6) }]} />
          <View style={s.restoreCard}>
            <View style={[s.iconOuter, { marginBottom: 16 }]}>
              <Smartphone size={32} color={PRIMARY} />
            </View>
            <Text style={[s.title, { marginBottom: 8 }]}>Account Found!</Text>
            <Text style={[s.sub, { marginBottom: 24 }]}>
              A deleted account for <Text style={{ fontWeight: "700", color: t.dark ? colors.white : colors.gray[900] }}>{contactInfo}</Text> was found. Do you want to
              restore your old data or start fresh with a new account?
            </Text>
            <View style={{ gap: 12, alignSelf: "stretch" }}>
              <Button onPress={() => handleRestoreAction("restore")} style={[s.finish, { height: 48 }]} textStyle={{ color: colors.white, fontWeight: "700" }}>
                Restore My Account
              </Button>
              <Button variant="outline" onPress={() => handleRestoreAction("new")} style={{ height: 48, borderRadius: 12, borderWidth: 2 }}>
                Create New Account
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </AnimatedPage>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  page: { flex: 1, backgroundColor: dark ? "#0a0a0a" : colors.gray[50] },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%",
    maxWidth: 450,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    borderWidth: 1,
    borderColor: dark ? colors.gray[800] : colors.gray[100],
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 25 },
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: dark ? colors.gray[800] : colors.gray[100] },
  headerTitle: { marginLeft: 16, fontWeight: "700", fontSize: 16, color: dark ? colors.white : colors.gray[900] },
  iconOuter: { width: 64, height: 64, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: alpha(PRIMARY, 0.1) },
  iconInner: { width: 40, height: 40, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY },
  title: { fontSize: 20, lineHeight: 25, fontWeight: "700", textAlign: "center", color: dark ? colors.white : colors.gray[900] },
  sub: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 320, color: dark ? colors.gray[400] : colors.gray[500] },
  box: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 12,
    borderColor: dark ? colors.gray[700] : colors.gray[200],
    backgroundColor: dark ? "#2a2a2a" : colors.white,
  },
  boxText: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  errorBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: dark ? alpha(colors.red[900], 0.1) : colors.red[50] },
  errorText: { fontSize: 12, lineHeight: 16, color: colors.red[500] },
  resend: { textAlign: "center", fontSize: 14, lineHeight: 20, color: dark ? colors.gray[400] : colors.gray[500] },
  nameInput: {
    height: 48,
    fontSize: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dark ? colors.gray[700] : colors.gray[300],
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    color: dark ? colors.white : colors.gray[900],
    paddingHorizontal: 12,
  },
  finish: { height: 48, borderRadius: 12, backgroundColor: PRIMARY },
  footer: { padding: 24, alignItems: "center", backgroundColor: dark ? "#1f1f1f" : colors.gray[50] },
  footerText: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: dark ? colors.gray[500] : colors.gray[400] },
  restoreCard: {
    width: "100%",
    maxWidth: 384,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    borderWidth: 1,
    borderColor: dark ? colors.gray[800] : colors.gray[100],
  },
}))
