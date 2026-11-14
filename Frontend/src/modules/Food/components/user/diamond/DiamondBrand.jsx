/**
 * Foodie Diamond visual language: dark base, icy-blue "diamond" metal for the
 * wordmark and accents (the counterpart of Zomato Gold's bronze).
 */

export const DIAMOND_BG = "#0B0E13"
export const DIAMOND_CARD = "#161B22"
export const DIAMOND_ICE = "#9EE6FF"
export const DIAMOND_ICE_SOFT = "#CDEFFC"
export const DIAMOND_FONT = "'Outfit', 'Figtree', sans-serif"

/** Metallic ice gradient used on text (bg-clip) and fills. */
export const DIAMOND_METAL =
  "linear-gradient(180deg, #F4FDFF 0%, #BDEFFF 38%, #5CC6EE 52%, #A8E6FA 68%, #EAFBFF 100%)"

/** Soft fill for buttons and pills (no hard band like the text metal). */
export const DIAMOND_BUTTON = "linear-gradient(135deg, #E6F9FF 0%, #B4EBFC 50%, #D2F3FE 100%)"

export const diamondTextStyle = {
  backgroundImage: DIAMOND_METAL,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
}

/** Faceted brilliant-cut gem. */
export function DiamondGem({ className = "h-6 w-6", id = "gem" }) {
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2FCFF" />
          <stop offset="1" stopColor="#7FD6F5" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B9EEFF" />
          <stop offset="1" stopColor="#2E9FD0" />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DDF7FF" />
          <stop offset="1" stopColor="#4BB8E6" />
        </linearGradient>
      </defs>
      {/* crown */}
      <path d="M16 2h32l14 16H2z" fill={`url(#${id}-a)`} />
      <path d="M16 2l8 16h16l8-16z" fill="#FFFFFF" opacity="0.55" />
      {/* pavilion */}
      <path d="M2 18h60L32 54z" fill={`url(#${id}-b)`} />
      <path d="M24 18h16L32 54z" fill={`url(#${id}-c)`} />
      <path d="M2 18h22l8 36z" fill="#1F7FAE" opacity="0.35" />
      <path d="M16 2L2 18h22z M48 2l14 16H40z" fill="#FFFFFF" opacity="0.25" />
    </svg>
  )
}

/** "Foodie" over "DIAMOND", the O drawn as a gem in a ring (like the crown in GOLD). */
export function DiamondWordmark({ size = "lg" }) {
  const big = size === "lg"
  const letters = big ? "text-[64px] min-[380px]:text-[72px]" : "text-[34px]"
  const ring = big ? "h-[50px] w-[50px] min-[380px]:h-[56px] min-[380px]:w-[56px] mx-0.5" : "h-[27px] w-[27px] mx-px"
  return (
    <div className="flex flex-col items-center select-none" style={{ fontFamily: DIAMOND_FONT }}>
      <span className={`${big ? "text-[30px]" : "text-[16px]"} font-extrabold tracking-tight text-white leading-none`}>
        Foodie
      </span>
      <span className={`${letters} mt-1 flex items-center font-black leading-none tracking-[-0.02em]`}>
        <span style={diamondTextStyle}>DIAM</span>
        <span
          className={`${ring} inline-flex shrink-0 items-center justify-center rounded-full`}
          style={{ backgroundImage: DIAMOND_METAL }}
        >
          <span className="flex h-[78%] w-[78%] items-center justify-center rounded-full" style={{ background: DIAMOND_BG }}>
            <DiamondGem className="h-[58%] w-[58%]" id={`wm-${size}`} />
          </span>
        </span>
        <span style={diamondTextStyle}>ND</span>
      </span>
    </div>
  )
}

/**
 * Faint faceted lines, like Zomato's Gold pattern. `corner` keeps them in the top-right
 * corner only and fades them out towards the rest of the card (as Zomato does).
 */
export function DiamondPattern({ className = "", corner = false }) {
  const fade = corner
    ? {
        WebkitMaskImage: "radial-gradient(62% 105% at 100% 0%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 78%)",
        maskImage: "radial-gradient(62% 105% at 100% 0%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 78%)",
      }
    : undefined
  return (
    <svg
      style={fade}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#8FD9F5" strokeOpacity={corner ? 0.22 : 0.09} strokeWidth="1.2">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 7 }).map((__, col) => {
            const x = col * 64 + (row % 2 ? 32 : 0) - 16
            const y = row * 56 - 10
            return <path key={`${row}-${col}`} d={`M${x} ${y + 14}l12-14h16l12 14-20 24z M${x + 12} ${y}l8 14 8-14`} />
          }),
        )}
      </g>
    </svg>
  )
}

export const formatINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

/** "22nd Dec 2026" */
export const formatMemberDate = (value) => {
  if (!value) return ""
  const d = new Date(value)
  const day = d.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th"
  return `${day}${suffix} ${d.toLocaleDateString("en-IN", { month: "short" })} ${d.getFullYear()}`
}
