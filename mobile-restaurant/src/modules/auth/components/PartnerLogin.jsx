// The partner login look, same as the customer app's login (mobile-user modules/auth/pages/Login.jsx): the admin login
// images slider on top (GET /food/login-pages/:app/images/public) with a white sheet under it ("Log in or sign up",
// India flag, +91 number, Continue, legal links), and the full white "OTP Verification" page (4 boxes, resend timer,
// block timer, "Go back to login methods") that slides in from the right.
// Only the look lives here: the screens keep their own API calls, session keys and navigation.
// The same file is in mobile-delivery and mobile-restaurant.
import React, { useEffect, useRef } from "react"
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Circle, Line, Rect } from "react-native-svg"
import { ArrowLeft, Loader2 } from "lucide-react-native"
import { Link } from "@/lib/router"
import { Text, TextInput } from "@/native/ui"
import { StatusBar } from "@/native/ui/SectionStatusBar"
import { alpha, colors } from "@/theme"
import useKeyboardOffset from "@/modules/Taxi/shared/hooks/useKeyboardOffset"
import { LoginImageSlider, LoginSliderDots, useLoginImageSlider } from "./LoginImageSlider"

export const LOGIN_RED = "#E23744"
const LOGIN_RED_PRESSED = "#CB202D"
// each app passes its own theme colour (delivery blue, restaurant crimson): button, cursor, links, slider backdrop
const SLIDER_ASPECT = 1350 / 1080
const SLIDER_SCREEN_SHARE = 0.56
const SHEET_MIN_HEIGHT = 236

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

export function LoginSpinner({ size = 20, color = colors.white }) {
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  )
}

/** Step 1: slider + white sheet with the number box. */
export function LoginNumberScreen({
  appType,
  title = "Log in or sign up",
  phone,
  onPhoneChange,
  phoneInputRef,
  onContinue,
  loading,
  phoneError,
  legalLinks = [],
  legalFrom,
  accent = LOGIN_RED,
  accentPressed = LOGIN_RED_PRESSED,
  children,
}) {
  const slider = useLoginImageSlider(appType)
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const keyboard = useKeyboardOffset()
  const keyboardOpen = keyboard > 120
  // the slider keeps the height it had with the keyboard closed
  const fullHeightRef = useRef(winH)
  if (winH > fullHeightRef.current) fullHeightRef.current = winH
  const screenH = fullHeightRef.current
  const sliderHeight = Math.max(
    Math.min(Math.round(winW * SLIDER_ASPECT), Math.round(screenH * SLIDER_SCREEN_SHARE), screenH - SHEET_MIN_HEIGHT),
    0,
  )

  return (
    // a tap anywhere outside the number box (the banner, the sheet) closes the keyboard and takes the focus away
    <Pressable style={styles.root} onPress={Keyboard.dismiss} accessible={false}>
      <StatusBar style="light" />
      <LoginImageSlider slider={slider} height={sliderHeight} fallbackColor={accent} />

      <View style={[styles.sheetWrap, { bottom: keyboard }]}>
        <View style={{ paddingBottom: 10 }}>
          <LoginSliderDots count={slider.images.length} activeIndex={slider.index} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          contentContainerStyle={[
            styles.sheet,
            {
              paddingBottom: keyboardOpen ? 16 : insets.bottom + 20,
              minHeight: keyboardOpen ? 0 : Math.max(screenH - sliderHeight, 0),
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.field, { width: 66, alignItems: "center", justifyContent: "center" }]}>
              <IndiaFlag />
            </View>
            <View style={[styles.field, { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16 }]}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                ref={phoneInputRef}
                value={phone}
                onChangeText={(v) => onPhoneChange(String(v || "").replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                inputMode="tel"
                autoComplete="tel-national"
                textContentType="telephoneNumber"
                maxLength={10}
                placeholder="Enter Phone Number"
                placeholderTextColor="#AFB4C0"
                cursorColor={accent}
                selectionColor={alpha(accent, 0.3)}
                accessibilityLabel="Mobile number"
                returnKeyType="done"
                onSubmitEditing={() => !loading && onContinue()}
                style={styles.phoneInput}
              />
            </View>
          </View>
          {phoneError ? <Text style={styles.phoneError}>{phoneError}</Text> : null}
          <Pressable
            onPress={onContinue}
            disabled={loading}
            style={({ pressed }) => [styles.primary, { marginTop: 20, backgroundColor: pressed ? accentPressed : accent }]}
          >
            {loading ? <LoginSpinner /> : <Text style={styles.primaryText}>Continue</Text>}
          </Pressable>

          {children}

          {!keyboardOpen && legalLinks.length > 0 ? (
            <View style={{ marginTop: "auto", paddingTop: 32, alignItems: "center" }}>
              <Text style={styles.legal}>By continuing, you agree to our</Text>
              <View style={{ marginTop: 2, flexDirection: "row", justifyContent: "center", gap: 12 }}>
                {legalLinks.map(({ to, label }) => (
                  <Link key={to} to={to} state={{ from: legalFrom }} style={styles.legalLink}>
                    <Text style={styles.legal}>{label}</Text>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Pressable>
  )
}

/** Step 2: the white OTP page. `children` replaces the code boxes (e.g. a name form) when given. */
export function LoginOtpScreen({
  phoneLabel,
  otp,
  inputRefs,
  onOtpChange,
  onOtpKeyPress,
  loading,
  otpError,
  blockTimer,
  resendTimer,
  onResend,
  onBack,
  accent = LOGIN_RED,
  children,
}) {
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const keyboard = useKeyboardOffset()
  // slides in from the right over the number screen (web: 0.25 s, ease [0.32, 0.72, 0, 1])
  const slide = useRef(new Animated.Value(winW)).current
  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 250, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }).start()
  }, [slide])
  const locked = loading || blockTimer > 0

  return (
    <Animated.View style={[styles.otpPage, { paddingTop: insets.top, transform: [{ translateX: slide }] }]}>
      <StatusBar style="dark" />
      <View style={{ height: 56, flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={onBack}
          accessibilityLabel="Go back and change number"
          style={({ pressed }) => [{ marginLeft: 10, borderRadius: 9999, padding: 6 }, pressed && { backgroundColor: colors.gray[100] }]}
        >
          <ArrowLeft size={24} color="#1C1C1C" strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.otpHeader}>OTP Verification</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: keyboard }}>
        <Text style={[styles.otpText, { marginTop: 24 }]}>We have sent a verification code to</Text>
        <Text style={[styles.otpText, { marginTop: 6, fontWeight: "600" }]}>{phoneLabel}</Text>

        {children || (
          <>
            <View style={{ marginTop: 44, flexDirection: "row", justifyContent: "center", gap: 17 }}>
              {[0, 1, 2, 3].map((index) => (
                <TextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  value={otp[index] || ""}
                  onChangeText={(v) => onOtpChange(index, v)}
                  onKeyPress={(e) => onOtpKeyPress(index, e)}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "sms-otp" : "off"}
                  textContentType={index === 0 ? "oneTimeCode" : "none"}
                  accessibilityLabel={`Digit ${index + 1} of the OTP`}
                  editable={!locked}
                  maxLength={index === 0 ? 4 : 2}
                  cursorColor={accent}
                  selectionColor={alpha(accent, 0.3)}
                  selectTextOnFocus
                  style={[styles.otpBox, locked && { opacity: 0.6 }]}
                />
              ))}
            </View>

            {otpError ? <Text style={[styles.otpError, { color: accent }]}>{otpError}</Text> : null}

            <View style={{ marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {loading ? (
                <>
                  <LoginSpinner size={16} color="#9197A6" />
                  <Text style={[styles.resendText, { color: "#9197A6" }]}>Verifying...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.resendText}>Didn&apos;t get the OTP?</Text>
                  {blockTimer > 0 ? (
                    <Text style={[styles.resendText, { color: "#9197A6" }]}>Resend SMS</Text>
                  ) : resendTimer > 0 ? (
                    <Text style={[styles.resendText, { color: "#9197A6" }]}>{`Resend SMS in ${resendTimer}s`}</Text>
                  ) : (
                    <Pressable onPress={onResend} hitSlop={8}>
                      <Text style={[styles.resendText, { color: accent }]}>Resend SMS</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {blockTimer > 0 ? (
              <View style={[styles.blockBox, { borderColor: alpha(accent, 0.2), backgroundColor: alpha(accent, 0.06) }]}>
                <Text style={[styles.blockTitle, { color: accent }]}>Too many failed attempts</Text>
                <Text style={[styles.blockText, { color: accent }]}>
                  {`Try again after ${Math.floor((blockTimer - 1) / 60)}:${String((blockTimer - 1) % 60).padStart(2, "0")}`}
                </Text>
              </View>
            ) : null}
          </>
        )}

        <Pressable onPress={onBack} style={{ alignSelf: "center", marginTop: "auto", paddingTop: 40, marginBottom: insets.bottom + 88 }}>
          <Text style={{ fontSize: 16, lineHeight: 22, color: accent }}>Go back to login methods</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  )
}

/** Red full-width button in the login style (for the extra steps shown on the OTP page). */
export function LoginPrimaryButton({ onPress, disabled, loading, label, style, accent = LOGIN_RED, accentPressed = LOGIN_RED_PRESSED }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, { backgroundColor: pressed && !disabled ? accentPressed : accent }, disabled && { opacity: 0.5 }, style]}
    >
      {loading ? <LoginSpinner /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  )
}

export const loginStyles = StyleSheet.create({
  field: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0D4DC",
    backgroundColor: colors.white,
    elevation: 1,
    shadowColor: "#1C1C1C",
    shadowOpacity: 0.12,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", overflow: "hidden" },
  sheetWrap: { position: "absolute", left: 0, right: 0, zIndex: 10, maxHeight: "100%" },
  sheet: { flexGrow: 1, backgroundColor: colors.white, paddingHorizontal: 24, paddingTop: 16 },
  title: { marginBottom: 16, textAlign: "center", fontSize: 16, lineHeight: 23, fontWeight: "500", color: "#596378" },
  field: loginStyles.field,
  prefix: { fontSize: 18, lineHeight: 24, color: "#1C1C1C" },
  phoneInput: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 24, color: "#1C1C1C", paddingVertical: 0 },
  phoneError: { marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.red[600] },
  primary: { height: 52, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, backgroundColor: LOGIN_RED },
  primaryText: { fontSize: 20, lineHeight: 26, color: colors.white },
  legal: { textAlign: "center", fontSize: 14, lineHeight: 20, color: "#414A5D" },
  legalLink: { borderBottomWidth: 1, borderStyle: "dotted", borderBottomColor: "#9CA3AF", paddingBottom: 1 },
  otpPage: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: colors.white },
  otpHeader: { marginLeft: 6, fontSize: 24, lineHeight: 28, color: "#1C1C1C" },
  otpText: { textAlign: "center", fontSize: 16, lineHeight: 23, color: "#1C1C1C" },
  otpBox: {
    height: 48,
    width: 43,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#D0D4DC",
    backgroundColor: colors.white,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "500",
    color: "#1C1C1C",
    paddingVertical: 0,
  },
  otpError: { marginTop: 12, textAlign: "center", fontSize: 14, lineHeight: 20, color: LOGIN_RED },
  resendText: { fontSize: 16, lineHeight: 22, fontWeight: "500", color: "#1C1C1C" },
  blockBox: {
    alignSelf: "center",
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.red[100],
    backgroundColor: colors.red[50],
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
  },
  blockTitle: { fontSize: 12, lineHeight: 16, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.6, color: LOGIN_RED },
  blockText: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: LOGIN_RED },
})
