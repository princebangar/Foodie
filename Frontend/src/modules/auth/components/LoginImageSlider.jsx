import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import api from "@food/api"

const AUTOPLAY_MS = 3500
const SLIDE_TRANSITION = { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
const SWIPE_THRESHOLD_PX = 50
const SWIPE_VELOCITY = 400

// Survives leaving the page (e.g. opening Terms and coming back), so the slider
// redraws at once while the list refreshes in the background.
const imagesByApp = new Map()

/**
 * Admin-managed images for one app's login page ("user" | "restaurant" | "delivery").
 *
 * The slides sit on one horizontal track like a pager. With two or more images the
 * track is [last, ...images, first]: `position` 1..count are the real slides and
 * 0 / count + 1 are copies, so the loop always slides forward (or back) and then
 * jumps to the real slide without anyone seeing it.
 */
export function useLoginImageSlider(appType) {
  const [images, setImages] = useState(() => imagesByApp.get(appType) || [])
  const [position, setPosition] = useState(1)
  const [paused, setPaused] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const count = images.length

  useEffect(() => {
    let cancelled = false
    api
      .get(`/food/login-pages/${appType}/images/public`)
      .then((res) => {
        const list = res?.data?.data?.images
        if (!Array.isArray(list)) return
        imagesByApp.set(appType, list)
        if (!cancelled) setImages(list)
      })
      .catch(() => {
        // The page still works without images; the slider's backdrop stays visible.
      })
    return () => {
      cancelled = true
    }
  }, [appType])

  // Load every slide up front so a slide never appears half-drawn.
  useEffect(() => {
    images.forEach(({ imageUrl }) => {
      new Image().src = imageUrl
    })
  }, [images])

  // The refreshed list can differ from the cached one.
  useEffect(() => {
    setPosition(1)
  }, [count])

  const step = (direction) => {
    if (count < 2) return
    setPosition((current) => Math.min(Math.max(current + direction, 0), count + 1))
  }

  /** After landing on a copy, move to the real slide it shows. */
  const settle = () => {
    setPosition((current) => (current === 0 ? count : current === count + 1 ? 1 : current))
  }

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion) return undefined
    const timer = setTimeout(() => step(1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
    // Restarting on every move also gives a full delay after a swipe.
  }, [count, position, paused, prefersReducedMotion])

  return {
    images,
    position,
    index: count ? (position - 1 + count) % count : 0,
    step,
    settle,
    setPaused,
    prefersReducedMotion,
  }
}

export function LoginImageSlider({ slider, height }) {
  const { images, position, step, settle, setPaused, prefersReducedMotion } = slider
  const count = images.length
  const looping = count > 1
  const slides = looping ? [images[count - 1], ...images, images[0]] : images

  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)
  const previousPosition = useRef(position)

  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    setWidth(node.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const targetFor = (slide) => (looping ? -slide * width : 0)

  useEffect(() => {
    if (!width) return undefined
    const from = previousPosition.current
    previousPosition.current = position
    const target = targetFor(position)
    const onCopy = looping && (position === 0 || position === count + 1)
    // The jump from a copy to its real slide must not be seen.
    const isLoopJump = looping && ((from === 0 && position === count) || (from === count + 1 && position === 1))

    if (isLoopJump || prefersReducedMotion || from === position) {
      x.set(target)
      if (onCopy) settle()
      return undefined
    }
    const controls = animate(x, target, {
      ...SLIDE_TRANSITION,
      onComplete: () => {
        if (onCopy) settle()
      },
    })
    return () => controls.stop()
  }, [position, width, count])

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ height }}
    >
      {/* Always behind the slides. The logo shows only while there are no admin
          images, so it never peeks through a transparent slide. */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#B80B3D] to-[#66001D]">
        {count === 0 && (
          <img
            src="/logo.webp"
            alt="Foodie"
            className="h-16 w-auto max-w-[70%] rounded-2xl object-contain shadow-lg"
          />
        )}
      </div>

      {count > 0 && (
        <motion.div
          className="relative flex h-full touch-pan-y"
          style={{ x }}
          drag={looping ? "x" : false}
          dragMomentum={false}
          onDragStart={() => setPaused(true)}
          onDragEnd={(_event, { offset, velocity }) => {
            setPaused(false)
            if (offset.x < -SWIPE_THRESHOLD_PX || velocity.x < -SWIPE_VELOCITY) step(1)
            else if (offset.x > SWIPE_THRESHOLD_PX || velocity.x > SWIPE_VELOCITY) step(-1)
            else animate(x, targetFor(position), SLIDE_TRANSITION)
          }}
        >
          {slides.map((image, slide) => (
            <img
              key={`${image._id}-${slide}`}
              src={image.imageUrl}
              alt=""
              draggable={false}
              className="h-full w-full shrink-0 select-none object-cover object-top"
              style={{ width: width || "100%" }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

export function LoginSliderDots({ count, activeIndex }) {
  if (count < 2) return null

  return (
    <div className="pointer-events-none flex h-2 items-center justify-center gap-0.5" aria-hidden="true">
      {Array.from({ length: count }, (_, dot) => (
        <span
          key={dot}
          className={`rounded-full transition-all duration-300 ${
            dot === activeIndex ? "h-2 w-2 bg-white" : "h-1.5 w-1.5 bg-white/55"
          }`}
        />
      ))}
    </div>
  )
}
