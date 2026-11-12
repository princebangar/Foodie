import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import api from "@food/api"

const AUTOPLAY_MS = 3500
const SWIPE_THRESHOLD_PX = 50

const slideVariants = {
  enter: (direction) => ({ x: `${direction * 100}%` }),
  center: { x: 0 },
  exit: (direction) => ({ x: `${direction * -100}%` }),
}

// Survives leaving the page (e.g. opening Terms and coming back), so the slider
// redraws at once while the list refreshes in the background.
const imagesByApp = new Map()

/** Admin-managed images for one app's login page ("user" | "restaurant" | "delivery"). */
export function useLoginImageSlider(appType) {
  const [images, setImages] = useState(() => imagesByApp.get(appType) || [])
  const [position, setPosition] = useState({ index: 0, direction: 1 })
  const prefersReducedMotion = useReducedMotion()

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

  const step = (direction) => {
    if (images.length < 2) return
    setPosition(({ index }) => ({
      index: (index + direction + images.length) % images.length,
      direction,
    }))
  }

  useEffect(() => {
    if (images.length < 2 || prefersReducedMotion) return undefined
    const timer = setTimeout(() => step(1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
    // Restarting on every index change also gives a full delay after a swipe.
  }, [images.length, position.index, prefersReducedMotion])

  return {
    images,
    // The refreshed list can be shorter than the cached one.
    index: images.length ? position.index % images.length : 0,
    direction: position.direction,
    step,
  }
}

export function LoginImageSlider({ slider, height }) {
  const { images, index, direction, step } = slider
  const current = images[index]

  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ height }}
    >
      {/* Always behind the slides: covers loading, no images and failed images. */}
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#B80B3D] to-[#66001D]">
        <img
          src="/logo.png"
          alt="Foodie"
          className="h-32 w-auto rounded-3xl object-contain"
        />
      </div>

      <AnimatePresence initial={false} custom={direction}>
        {current && (
          <motion.img
            key={current._id}
            src={current.imageUrl}
            alt=""
            draggable={false}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            drag={images.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_event, { offset }) => {
              if (offset.x < -SWIPE_THRESHOLD_PX) step(1)
              else if (offset.x > SWIPE_THRESHOLD_PX) step(-1)
            }}
            className="absolute inset-0 h-full w-full select-none object-cover object-top"
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export function LoginSliderDots({ count, activeIndex }) {
  if (count < 2) return null

  return (
    <div className="pointer-events-none flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, dot) => (
        <span
          key={dot}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            dot === activeIndex ? "bg-white" : "bg-white/45"
          }`}
        />
      ))}
    </div>
  )
}
