// The partner (restaurant / delivery) login look, same as the partner apps (mobile-restaurant / mobile-delivery
// modules/auth/components/PartnerLogin.jsx) and the customer login (modules/auth/pages/Login.jsx): the admin login
// images slider on top (GET /food/login-pages/:app/images/public) with a white sheet under it ("Log in or sign up",
// India flag, +91 number, Continue, legal links), and the full white "OTP Verification" page (4 boxes, resend timer,
// block timer, "Go back to login methods") that slides in from the right.
// Only the look lives here: the pages keep their own API calls, session keys and navigation.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Loader2 } from "lucide-react"
import { LoginImageSlider, LoginSliderDots, useLoginImageSlider } from "./LoginImageSlider"

export const LOGIN_RED = "#E23744"
const LOGIN_RED_PRESSED = "#CB202D"

// Slides are 1080 x 1350 (4:5), shown full width with the sheet right below.
const SLIDER_ASPECT = 1350 / 1080
const SLIDER_SCREEN_SHARE = 0.56
// Room the form always keeps on short screens; the slider shrinks instead.
const SHEET_MIN_HEIGHT = 236

const FIELD_CLASS =
  "h-12 rounded-lg border border-[#D0D4DC] bg-white shadow-[0_1px_2px_rgba(28,28,28,0.12)]"

function IndiaFlag() {
  return (
    <svg viewBox="0 0 30 20" preserveAspectRatio="none" className="h-[15px] w-[23px] rounded-[3px]" role="img" aria-label="India">
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="6.67" width="30" height="6.66" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="15" cy="10" r="0.5" fill="#000080" />
      {Array.from({ length: 12 }, (_, spoke) => (
        <line key={spoke} x1="15" y1="10" x2="15" y2="7.4" stroke="#000080" strokeWidth="0.25" transform={`rotate(${spoke * 30} 15 10)`} />
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

/** The page frame both steps share: a phone-width column (480 px from md up) that follows the keyboard. */
export function LoginFrame({ fontFamily, children }) {
  const viewport = useKeyboardAwareViewport()
  return (
    <div
      className="fixed inset-x-0 z-0 flex justify-center overflow-hidden bg-black"
      style={{ top: viewport.top, height: viewport.height, fontFamily }}
    >
      <div className="relative h-full w-full bg-white md:max-w-[480px]">
        {typeof children === "function" ? children(viewport) : children}
      </div>
    </div>
  )
}

function PrimaryButton({ type = "button", onClick, disabled, loading, label, accent, accentPressed, className = "" }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ backgroundColor: pressed && !disabled ? accentPressed : accent }}
      className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-[20px] font-normal text-white transition-colors disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
    </button>
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
  onLegalClick,
  accent = LOGIN_RED,
  accentPressed = LOGIN_RED_PRESSED,
  fontFamily,
  children,
}) {
  const slider = useLoginImageSlider(appType)

  return (
    <LoginFrame fontFamily={fontFamily}>
      {(viewport) => {
        const columnWidth = viewport.width >= 768 ? Math.min(viewport.width, 480) : viewport.width
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
          <>
            <LoginImageSlider slider={slider} height={sliderHeight} fallbackColor={accent} />

            <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col">
              <div className="pb-2.5">
                <LoginSliderDots count={slider.images.length} activeIndex={slider.index} />
              </div>

              <div
                className="flex flex-col overflow-y-auto bg-white px-4 pt-4 min-[360px]:px-6"
                style={{
                  paddingBottom: keyboardOpen ? 16 : "calc(env(safe-area-inset-bottom, 0px) + 20px)",
                  minHeight: keyboardOpen ? 0 : Math.max(viewport.height - sliderHeight, 0),
                }}
              >
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!loading) onContinue()
                  }}
                >
                  <h1 className="mb-4 text-center text-[16px] font-medium leading-[23px] text-[#596378]">{title}</h1>

                  <div className="flex gap-2.5">
                    <div className={`${FIELD_CLASS} flex w-[66px] shrink-0 items-center justify-center`}>
                      <IndiaFlag />
                    </div>
                    <label className={`${FIELD_CLASS} flex min-w-0 flex-1 items-center gap-1.5 px-4`}>
                      <span className="text-[18px] font-normal text-[#1C1C1C]">+91</span>
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-label="Mobile number"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        style={{ caretColor: accent }}
                        className="w-full min-w-0 bg-transparent text-[18px] font-normal text-[#1C1C1C] outline-none placeholder:text-[16px] placeholder:text-[#AFB4C0] min-[360px]:placeholder:text-[18px]"
                        placeholder="Enter Phone Number"
                      />
                    </label>
                  </div>

                  {phoneError ? (
                    <p role="alert" className="mt-2 text-[13px] font-medium text-red-600">
                      {phoneError}
                    </p>
                  ) : null}

                  <PrimaryButton
                    type="submit"
                    loading={loading}
                    label="Continue"
                    accent={accent}
                    accentPressed={accentPressed}
                    className="mt-5"
                  />
                </form>

                {children}

                {!keyboardOpen && legalLinks.length > 0 ? (
                  <div className="mt-auto pt-8 text-center text-[14px] font-normal leading-[20px] text-[#414A5D]">
                    <p>By continuing, you agree to our</p>
                    <p className="mt-0.5 flex justify-center gap-3">
                      {legalLinks.map(({ to, label }) => (
                        <Link
                          key={to}
                          to={to}
                          state={{ from: legalFrom }}
                          onClick={onLegalClick}
                          className="border-b border-dotted border-[#9CA3AF] pb-px"
                        >
                          {label}
                        </Link>
                      ))}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )
      }}
    </LoginFrame>
  )
}

/** Step 2: the white OTP page. `children` replaces the code boxes (e.g. a name form) when given. */
export function LoginOtpScreen({
  phoneLabel,
  otp,
  inputRefs,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  loading,
  otpError,
  blockTimer,
  resendTimer,
  onResend,
  onBack,
  accent = LOGIN_RED,
  fontFamily,
  children,
}) {
  const locked = loading || blockTimer > 0

  return (
    <LoginFrame fontFamily={fontFamily}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="absolute inset-0 z-20 flex flex-col bg-white text-[#1C1C1C]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-14 shrink-0 items-center">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back and change number"
            className="ml-2.5 rounded-full p-1.5 active:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <h1 className="ml-1.5 text-[24px] font-normal leading-none">OTP Verification</h1>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          <p className="mt-6 text-center text-[16px] leading-[23px]">We have sent a verification code to</p>
          <p className="mt-1.5 text-center text-[16px] font-semibold leading-[23px]">{phoneLabel}</p>

          {children || (
            <>
              <div className="mt-11 flex justify-center gap-[17px]">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el
                    }}
                    type="tel"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${index + 1} of the OTP`}
                    disabled={locked}
                    autoFocus={index === 0}
                    value={otp[index] || ""}
                    onChange={(e) => onOtpChange(index, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                    onPaste={index === 0 ? onOtpPaste : undefined}
                    onFocus={(e) => e.target.select()}
                    style={{ caretColor: accent, borderColor: otpError ? accent : undefined }}
                    className="h-12 w-[43px] rounded-[7px] border border-[#D0D4DC] bg-white text-center text-[20px] font-medium text-[#1C1C1C] outline-none focus:border-[#1C1C1C] focus:shadow-[0_0_0_1px_#1C1C1C] disabled:opacity-60"
                  />
                ))}
              </div>

              {otpError ? (
                <p role="alert" className="mt-3 text-center text-[14px]" style={{ color: accent }}>
                  {otpError}
                </p>
              ) : null}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[16px] font-medium">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#9197A6]" />
                    <span className="text-[#9197A6]">Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Didn&apos;t get the OTP?</span>
                    {blockTimer > 0 ? (
                      <span className="text-[#9197A6]">Resend SMS</span>
                    ) : resendTimer > 0 ? (
                      <span className="text-[#9197A6]">Resend SMS in {resendTimer}s</span>
                    ) : (
                      <button type="button" onClick={onResend} style={{ color: accent }}>
                        Resend SMS
                      </button>
                    )}
                  </>
                )}
              </div>

              {blockTimer > 0 ? (
                <div
                  className="mx-auto mt-5 w-fit rounded-lg border px-5 py-2.5 text-center"
                  style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0F` }}
                >
                  <p className="text-[12px] font-medium uppercase tracking-wider" style={{ color: accent }}>
                    Too many failed attempts
                  </p>
                  <p className="text-[14px] font-semibold" style={{ color: accent }}>
                    Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, "0")}
                  </p>
                </div>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={onBack}
            className="mx-auto mt-auto pt-10 text-[16px] leading-[22px]"
            style={{ color: accent, marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
          >
            Go back to login methods
          </button>
        </div>
      </motion.div>
    </LoginFrame>
  )
}

/** Full-width button in the login style (for the extra steps shown on the OTP page). */
export function LoginPrimaryButton({ onClick, disabled, loading, label, className, accent = LOGIN_RED, accentPressed = LOGIN_RED_PRESSED }) {
  return (
    <PrimaryButton
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      label={label}
      accent={accent}
      accentPressed={accentPressed}
      className={className}
    />
  )
}
