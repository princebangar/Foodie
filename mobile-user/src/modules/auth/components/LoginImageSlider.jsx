// Web: modules/auth/components/LoginImageSlider.jsx — admin-managed images on a login page ("user" | "restaurant" |
// "delivery", GET /food/login-pages/:app/images/public). The slides sit on one horizontal track like a pager; with two
// or more images the track is [last, ...images, first] so the loop always slides forward, then jumps to the real slide
// unseen. Autoplay every 3.5 s, swipe to move (pauses autoplay while dragging). The last list is kept in localStorage
// so the slides show at once on the next open. Same exports: useLoginImageSlider, LoginImageSlider, LoginSliderDots.
// Built-in banners (src/assets/login-defaults) show until the admin list is on the phone; a new list replaces the shown
// one only after its images have downloaded, at the next slide change, with a short fade (no blank or half-drawn slide).
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native"
import { Image as ExpoImage } from "expo-image"
import api from "@food/api"
import DEFAULT_LOGIN_SLIDES from "../../../assets/login-defaults/index.js"

const AUTOPLAY_MS = 3500
const SLIDE_MS = 550
const SLIDE_EASE = Easing.bezier(0.32, 0.72, 0, 1)
const SWIPE_THRESHOLD_PX = 50
const SWIPE_VELOCITY = 0.4 // px / ms (web: 400 px / s)

const imagesByApp = new Map()
const storageKey = (appType) => `login_images_${appType}`
const readStoredImages = (appType) => {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(appType)) || "[]")
    return Array.isArray(list) ? list.filter((item) => item && typeof item.imageUrl === "string") : []
  } catch {
    return []
  }
}
const storeImages = (appType, list) => {
  try {
    localStorage.setItem(storageKey(appType), JSON.stringify(list.map(({ _id, imageUrl }) => ({ _id, imageUrl }))))
  } catch {
    // the slider still works, just not instantly next time
  }
}

// The list request + image downloads start at app open (root layout, while the splash plays), not when the login
// screen mounts: on a slow network the slides are then ready (or already on disk) when the login appears.
const LIST_FRESH_MS = 60 * 1000
const requests = new Map() // appType -> { at, promise }
const prefetchUrls = (list) => {
  const urls = list.map(({ imageUrl }) => imageUrl).filter(Boolean)
  if (urls.length) ExpoImage.prefetch(urls, "memory-disk").catch(() => {})
}

/** Fetch the admin list (once a minute at most) and download its images to the disk cache. Resolves to the list or null. */
export function preloadLoginImages(appType) {
  const current = requests.get(appType)
  if (current && Date.now() - current.at < LIST_FRESH_MS) return current.promise
  // the slides saved last time: make sure their files are in memory before the list request comes back
  const saved = imagesByApp.get(appType) || readStoredImages(appType)
  if (saved.length) prefetchUrls(saved)
  const promise = api
    .get(`/food/login-pages/${appType}/images/public`)
    .then((res) => {
      const list = res?.data?.data?.images
      if (!Array.isArray(list)) return null
      imagesByApp.set(appType, list)
      storeImages(appType, list)
      prefetchUrls(list)
      return list
    })
    .catch(() => {
      requests.delete(appType)
      return null
    })
  requests.set(appType, { at: Date.now(), promise })
  return promise
}

const slideKey = (item) => item?.imageUrl || item?._id
const sameSlides = (a, b) => a.length === b.length && a.every((item, i) => slideKey(item) === slideKey(b[i]))
const downloadAll = (list) => {
  const urls = list.map(({ imageUrl }) => imageUrl).filter(Boolean)
  return urls.length ? ExpoImage.prefetch(urls, "memory-disk").catch(() => false) : Promise.resolve(true)
}
const initialSlides = (appType) => {
  const list = imagesByApp.get(appType) || readStoredImages(appType)
  return list.length ? list : DEFAULT_LOGIN_SLIDES
}

export function useLoginImageSlider(appType) {
  const [images, setImages] = useState(() => initialSlides(appType))
  const [position, setPosition] = useState(1)
  const [paused, setPaused] = useState(false)
  const count = images.length
  const imagesRef = useRef(images)
  imagesRef.current = images
  // a newer list, already downloaded, waiting for the next slide change
  const pendingRef = useRef(null)

  const applyPending = () => {
    const next = pendingRef.current
    if (!next) return false
    pendingRef.current = null
    setImages(next)
    setPosition(1)
    return true
  }

  useEffect(() => {
    let cancelled = false
    preloadLoginImages(appType).then((list) => {
      if (!list || cancelled) return
      const next = list.length ? list : DEFAULT_LOGIN_SLIDES
      if (sameSlides(imagesRef.current, next)) return
      downloadAll(next).then(() => {
        if (cancelled) return
        pendingRef.current = next
        // no autoplay to wait for (0-1 slides on screen): switch now
        if (imagesRef.current.length < 2) applyPending()
      })
    })
    return () => {
      cancelled = true
    }
  }, [appType])

  // load every slide up front so a slide never appears half-drawn
  useEffect(() => {
    const urls = images.map(({ imageUrl }) => imageUrl).filter(Boolean)
    if (urls.length) ExpoImage.prefetch(urls).catch(() => {})
  }, [images])

  useEffect(() => {
    setPosition(1)
  }, [count])

  const step = (direction) => {
    if (count < 2) return
    setPosition((current) => Math.min(Math.max(current + direction, 0), count + 1))
  }

  const settle = () => {
    setPosition((current) => (current === 0 ? count : current === count + 1 ? 1 : current))
  }

  useEffect(() => {
    if (count < 2 || paused) return undefined
    const timer = setTimeout(() => {
      if (!applyPending()) step(1)
    }, AUTOPLAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, position, paused])

  return {
    images,
    position,
    index: count ? (position - 1 + count) % count : 0,
    step,
    settle,
    setPaused,
  }
}

export function LoginImageSlider({ slider, height, fallbackColor = "#E23744" }) {
  const { images, position, step, settle, setPaused } = slider
  const count = images.length
  const looping = count > 1
  const slides = looping ? [images[count - 1], ...images, images[0]] : images
  const [width, setWidth] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  const base = useRef(0)
  const previousPosition = useRef(position)
  const previousImages = useRef(images)
  const fade = useRef(new Animated.Value(1)).current
  const latest = useRef({ position, width, looping, step, setPaused })
  latest.current = { position, width, looping, step, setPaused }

  const targetFor = (slide, w = width) => (looping ? -slide * w : 0)

  useEffect(() => {
    if (!width) return undefined
    const from = previousPosition.current
    previousPosition.current = position
    const target = targetFor(position)
    const onCopy = looping && (position === 0 || position === count + 1)
    const isLoopJump = looping && ((from === 0 && position === count) || (from === count + 1 && position === 1))
    const listChanged = previousImages.current !== images
    previousImages.current = images
    if (listChanged) {
      fade.setValue(0.35)
      Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
    }
    if (listChanged || isLoopJump || from === position) {
      x.setValue(target)
      base.current = target
      if (onCopy) settle()
      return undefined
    }
    const anim = Animated.timing(x, { toValue: target, duration: SLIDE_MS, easing: SLIDE_EASE, useNativeDriver: true })
    anim.start(({ finished }) => {
      base.current = target
      if (finished && onCopy) settle()
    })
    return () => anim.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, width, count, images])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => latest.current.looping && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        latest.current.setPaused(true)
        x.stopAnimation((v) => {
          base.current = v
        })
      },
      onPanResponderMove: (_e, g) => x.setValue(base.current + g.dx),
      onPanResponderRelease: (_e, g) => {
        const { setPaused: unpause, step: move, position: pos, width: w } = latest.current
        unpause(false)
        if (g.dx < -SWIPE_THRESHOLD_PX || g.vx < -SWIPE_VELOCITY) move(1)
        else if (g.dx > SWIPE_THRESHOLD_PX || g.vx > SWIPE_VELOCITY) move(-1)
        else Animated.timing(x, { toValue: -pos * w, duration: SLIDE_MS, easing: SLIDE_EASE, useNativeDriver: true }).start()
      },
      onPanResponderTerminate: () => latest.current.setPaused(false),
    }),
  ).current

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* The app theme colour behind the slides; only seen before the admin images have ever loaded. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackColor }]} />
      {count > 0 && width > 0 ? (
        <Animated.View {...pan.panHandlers} style={{ flexDirection: "row", height: "100%", opacity: fade, transform: [{ translateX: x }] }}>
          {slides.map((image, slide) => (
            <ExpoImage
              key={`${image._id}-${slide}`}
              source={image.source || { uri: image.imageUrl }}
              contentFit="cover"
              contentPosition="top"
              cachePolicy="memory-disk"
              transition={0}
              style={{ width, height: "100%" }}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  )
}

export function LoginSliderDots({ count, activeIndex }) {
  if (count < 2) return null
  return (
    <View pointerEvents="none" style={{ height: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 }}>
      {Array.from({ length: count }, (_, dot) => (
        <View
          key={dot}
          style={
            dot === activeIndex
              ? { height: 8, width: 8, borderRadius: 9999, backgroundColor: "#ffffff" }
              : { height: 6, width: 6, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.55)" }
          }
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
})
