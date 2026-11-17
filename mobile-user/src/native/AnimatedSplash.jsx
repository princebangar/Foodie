// App splash (native addition; the web's App.jsx splash is commented out). Foodie red; the restaurant (cloche) and
// delivery (scooter) apps have their own scene, the customer app builds a burger:
//   1. entrance: the white "Foodie" wordmark starts exactly where the native splash (app.json) drew it, grows and
//      lifts; a warm spotlight and a plate fade in below it (fades only: the UI thread stalls while the app mounts
//      behind the splash, and anything moving then jumps - restaurant/delivery lesson);
//   2. show (once the app is ready and mounted, so the UI thread is free): the burger is built on the plate layer by
//      layer - bun, patty, melting cheese, lettuce, tomato, sesame top bun - each one dropping in with a small bounce;
//      fries and a cold drink pop up beside the plate, steam rises, sparkles burst and "ORDER · EAT · REPEAT" fades in;
//   3. exit: the scene zooms a little and fades into the app.
// Prince (18 Nov): the old scene (thin outline icons + a growing name that rendered huge and off-centre because the
// smile's JS-driven width was mixed with native-driven transforms) "had nothing of food in it" - replaced.
// Every animation runs on the native driver. Same API as the other Foodie apps: ready / onShown / onDone, SPLASH_BG.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { fonts } from '@/theme';

// white "Foodie" letters + green leaf + smile, 900 x 421 (same mark as assets/splash-icon-light.png, where it is
// 70 % of the 1024 canvas shown 240 dp wide)
const WORDMARK = require('../../assets/splash-wordmark-light.png');
const WORDMARK_RATIO = 421 / 900;
const NATIVE_WORDMARK_W = 240 * 0.7;

export const SPLASH_BG = '#B80B3D'; // app.json splash background
const WARM = '#FFD58A';

const START_DELAY_MS = 380; // the native splash fades out over ~300 ms: start after it
const ENTRANCE_MS = 900; // wordmark grows + lifts, plate fades in
const SHOW_DELAY_MS = 220; // lets the first screen behind the splash finish mounting
const SHOW_MS = 2100; // the burger being built
const EXIT_MS = 480;
const SMOOTH_FRAMES = 4;
const SMOOTH_FRAME_MS = 26;
const SMOOTH_MAX_WAIT_MS = 1200;
const MAX_WAIT_MS = 3000;
// Android does not draw a view at opacity 0: parts start at PRE (invisible on screen) so their first draw happens
// before anything moves
const PRE = 0.004;

// scene: viewBox 240 x 160, burger centred on x = 120, plate top at y = 140
const VB_W = 240;
const VB_H = 160;

// burger layers, bottom -> top (drop order); `at` = start on the show timeline (0..1)
const LAYERS = [
  {
    key: 'bun-bottom',
    at: 0.0,
    draw: (
      <G>
        <Path d="M74 126 H166 Q166 141 152 141 H88 Q74 141 74 126 Z" fill="#D9862B" />
        <Path d="M76 126 H164 Q163 130 160 131 H80 Q77 130 76 126 Z" fill="#F2B55A" />
      </G>
    ),
  },
  {
    key: 'patty',
    at: 0.1,
    draw: (
      <G>
        <Rect x="68" y="112" width="104" height="15" rx="7.5" fill="#5B2E14" />
        <Rect x="72" y="114" width="96" height="4" rx="2" fill="#7A4123" />
        {[84, 100, 118, 136, 152].map((x) => (
          <Circle key={x} cx={x} cy={121} r={1.4} fill="#3B1C0B" />
        ))}
      </G>
    ),
  },
  {
    key: 'cheese',
    at: 0.2,
    draw: (
      <Path
        d="M66 107 H174 V113 H160 Q157 113 156 117 L153 124 Q151 128 149 124 L146 116 Q145 113 141 113 H112 Q108 113 107 117 L104 126 Q102 130 100 126 L97 117 Q96 113 92 113 H80 Q76 113 75 116 L73 120 Q71 123 69 120 L66 113 Z"
        fill="#FBBF24"
      />
    ),
  },
  {
    key: 'lettuce',
    at: 0.3,
    draw: (
      <Path
        d="M64 105 Q70 98 76 104 Q82 98 88 104 Q94 98 100 104 Q106 98 112 104 Q118 98 124 104 Q130 98 136 104 Q142 98 148 104 Q154 98 160 104 Q166 98 172 104 Q176 108 172 109 H68 Q62 108 64 105 Z"
        fill="#22C55E"
      />
    ),
  },
  {
    key: 'tomato',
    at: 0.4,
    draw: (
      <G>
        <Rect x="74" y="94" width="44" height="8" rx="4" fill="#EF4444" />
        <Rect x="122" y="94" width="44" height="8" rx="4" fill="#EF4444" />
        <Rect x="80" y="96" width="30" height="2" rx="1" fill="#FCA5A5" />
        <Rect x="128" y="96" width="30" height="2" rx="1" fill="#FCA5A5" />
      </G>
    ),
  },
  {
    key: 'bun-top',
    at: 0.52,
    draw: (
      <G>
        <Path d="M68 95 Q68 56 120 54 Q172 56 172 95 Q172 99 167 99 H73 Q68 99 68 95 Z" fill="#E39A3B" />
        <Path d="M80 80 Q84 64 108 60" stroke="#F8C77A" strokeWidth="5" strokeLinecap="round" fill="none" />
        {[
          [100, 66, -20],
          [120, 63, 0],
          [140, 67, 20],
          [90, 78, -30],
          [111, 75, -8],
          [131, 76, 10],
          [151, 80, 30],
        ].map(([x, y, r]) => (
          <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={3.2} ry={1.6} fill="#FFF7E0" rotation={r} origin={`${x}, ${y}`} />
        ))}
      </G>
    ),
  },
];
const LAND = 0.12; // share of the timeline a layer takes to fall
const BOUNCE = 0.07;
const LAST_LANDS = LAYERS[LAYERS.length - 1].at + LAND; // the top bun lands: burst + steam start

// sparkles bursting from the top of the burger when the top bun lands: angle (deg), distance (viewBox units), colour
const SPARKS = [
  [-160, 70, '#FDE68A'],
  [-130, 62, '#FFFFFF'],
  [-100, 58, '#4ADE80'],
  [-75, 60, '#FDE68A'],
  [-50, 64, '#FFFFFF'],
  [-20, 72, '#FB923C'],
  [-145, 44, '#FB923C'],
  [-35, 46, '#4ADE80'],
  [-90, 36, '#FFFFFF'],
];

function Fries() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 40 52">
      {[
        [8, 6, -8],
        [14, 2, -3],
        [20, 0, 2],
        [26, 3, 6],
        [31, 7, 10],
        [11, 10, -12],
        [23, 6, 0],
      ].map(([x, y, r]) => (
        <Rect key={`${x}-${y}`} x={x} y={y} width="5" height="26" rx="1.5" fill="#FCD34D" rotation={r} origin={`${x + 2.5}, 30`} />
      ))}
      <Path d="M3 22 H37 L33 51 H7 Z" fill="#DC2626" />
      <Path d="M3 22 Q20 32 37 22" fill="#B91C1C" />
      <Path d="M15 36 Q20 41 25 36" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Soda() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 36 56">
      <Rect x="20" y="0" width="3.5" height="16" rx="1.5" fill="#F472B6" rotation={14} origin="22, 16" />
      <Rect x="3" y="12" width="30" height="6" rx="3" fill="#E2E8F0" />
      <Path d="M5 18 H31 L28 55 H8 Z" fill="#FFFFFF" />
      <Path d="M6.2 30 H29.8 L29 40 H7 Z" fill="#DC2626" />
      <Path d="M14 35 Q18 38 22 35" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** ready: the app can show its first screen. onShown: hide the native splash. onDone: unmount the splash. */
export function AnimatedSplash({ ready, onShown, onDone }) {
  const { width, height } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current; // wordmark + plate 0 -> 1
  const show = useRef(new Animated.Value(0)).current; // burger build 0 -> 1
  const exit = useRef(new Animated.Value(0)).current; // leave 0 -> 1
  const [entered, setEntered] = useState(false);
  const [shown, setShown] = useState(false);
  const shownAtRef = useRef(0);
  const startRef = useRef(null);
  const showingRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // wordmark laid out at its final size (sharp), scaled down to the native splash's size at the start
  const WORDMARK_W = Math.round(Math.min(250, width * 0.62));
  const WORDMARK_H = Math.round(WORDMARK_W * WORDMARK_RATIO);
  const startScale = NATIVE_WORDMARK_W / WORDMARK_W;
  const LIFT_Y = Math.min(200, height * 0.23); // final wordmark centre ~27 % down
  // scene box under the wordmark
  const BW = Math.round(Math.min(width * 0.9, 360));
  const BH = Math.round((BW * VB_H) / VB_W);
  const k = BW / VB_W; // viewBox unit -> dp
  const sceneTop = Math.max(height * 0.6 - BH / 2, height / 2 - LIFT_Y + WORDMARK_H / 2 + 8);
  const taglineTop = sceneTop + BH + 14;
  const DROP = Math.min(height * 0.3, 260); // how far above its place a layer starts falling

  // hide the native splash once this one is drawn (hiding it on mount left a bare frame)
  const shownRef = useRef(false);
  const handleLayout = () => {
    if (shownRef.current) return;
    shownRef.current = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        onShown?.();
        shownAtRef.current = Date.now();
        setShown(true);
      }),
    );
  };

  // entrance: after the native splash has faded, once ready and frames come smoothly again
  useEffect(() => {
    if (!shown || !ready) return undefined;
    let cancelled = false;
    let raf = 0;
    const waitForSmoothFrames = () => {
      const since = Date.now();
      let last = since;
      let smooth = 0;
      const tick = () => {
        if (cancelled) return;
        const now = Date.now();
        smooth = now - last < SMOOTH_FRAME_MS ? smooth + 1 : 0;
        last = now;
        if (smooth >= SMOOTH_FRAMES || now - since > SMOOTH_MAX_WAIT_MS) startRef.current?.();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(waitForSmoothFrames, Math.max(0, START_DELAY_MS - (Date.now() - shownAtRef.current)));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [shown, ready]);

  useEffect(() => {
    let started = false;
    const timers = [];
    const start = () => {
      if (started) return;
      started = true;
      Animated.timing(enter, { toValue: 1, duration: ENTRANCE_MS, easing: Easing.bezier(0.42, 0, 0.2, 1), useNativeDriver: true }).start(() =>
        setEntered(true),
      );
      timers.push(setTimeout(() => setEntered(true), ENTRANCE_MS + 400));
    };
    startRef.current = start;
    timers.push(setTimeout(start, MAX_WAIT_MS)); // never laid out (should not happen)
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  // build the burger, then leave (onDone read from a ref: a re-render of the root layout cannot cancel the exit)
  useEffect(() => {
    if (!ready || !entered || showingRef.current) return undefined;
    showingRef.current = true;
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(show, { toValue: 1, duration: SHOW_MS, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(exit, { toValue: 1, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => onDoneRef.current?.());
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, entered, show, exit]);

  // ---- entrance
  const wordY = enter.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT_Y] });
  const wordScale = enter.interpolate({ inputRange: [0, 1], outputRange: [startScale, 1] });
  const plate = enter.interpolate({ inputRange: [0.3, 0.7, 1], outputRange: [PRE, 0.85, 1], extrapolate: 'clamp' });

  // ---- show
  const layerStyle = (at) => ({
    opacity: show.interpolate({ inputRange: [at, at + 0.03], outputRange: [PRE, 1], extrapolate: 'clamp' }),
    transform: [
      {
        // falls (accelerating), lands, small bounce, settles
        translateY: show.interpolate({
          inputRange: [at, at + LAND * 0.55, at + LAND, at + LAND + BOUNCE * 0.5, at + LAND + BOUNCE],
          outputRange: [-DROP, -DROP * 0.42, 0, -7, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  });
  // the whole burger squashes a little as the top bun lands
  const squash = show.interpolate({
    inputRange: [LAST_LANDS - 0.005, LAST_LANDS + 0.03, LAST_LANDS + 0.09],
    outputRange: [1, 0.93, 1],
    extrapolate: 'clamp',
  });
  const popStyle = (at, fromX) => {
    const p = show.interpolate({ inputRange: [at, at + 0.1, at + 0.16], outputRange: [0, 1.15, 1], extrapolate: 'clamp' });
    return {
      opacity: show.interpolate({ inputRange: [at, at + 0.04], outputRange: [PRE, 1], extrapolate: 'clamp' }),
      transform: [
        { translateX: show.interpolate({ inputRange: [at, at + 0.12], outputRange: [fromX, 0], extrapolate: 'clamp' }) },
        { scale: Animated.add(0.001, p) },
        { rotate: show.interpolate({ inputRange: [at, at + 0.16], outputRange: [fromX < 0 ? '-25deg' : '25deg', '0deg'], extrapolate: 'clamp' }) },
      ],
    };
  };
  const steam = show.interpolate({ inputRange: [LAST_LANDS, LAST_LANDS + 0.12, 1], outputRange: [PRE, 0.9, 0.7], extrapolate: 'clamp' });
  const steamY = show.interpolate({ inputRange: [LAST_LANDS, 1], outputRange: [8 * k, -10 * k], extrapolate: 'clamp' });
  const glow = show.interpolate({ inputRange: [LAST_LANDS - 0.05, LAST_LANDS + 0.1, 1], outputRange: [PRE, 0.5, 0.35], extrapolate: 'clamp' });
  const burst = show.interpolate({ inputRange: [LAST_LANDS, LAST_LANDS + 0.22], outputRange: [0, 1], extrapolate: 'clamp' });
  const burstFade = show.interpolate({ inputRange: [LAST_LANDS, LAST_LANDS + 0.02, LAST_LANDS + 0.16, LAST_LANDS + 0.26], outputRange: [PRE, 1, 1, 0], extrapolate: 'clamp' });
  const tagline = show.interpolate({ inputRange: [0.72, 0.88], outputRange: [PRE, 1], extrapolate: 'clamp' });
  const taglineY = show.interpolate({ inputRange: [0.72, 0.88], outputRange: [10, 0], extrapolate: 'clamp' });

  // ---- exit
  const fade = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const zoom = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const box = { position: 'absolute', left: (width - BW) / 2, top: sceneTop, width: BW, height: BH };
  const full = StyleSheet.absoluteFill;
  const burstX = (width - BW) / 2 + 120 * k;
  const burstY = sceneTop + 58 * k;

  return (
    <Animated.View
      pointerEvents={entered && ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}
      onLayout={handleLayout}
    >
      <StatusBar style="light" />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}>
        {/* warm spotlight + plate (entrance) */}
        <Animated.View style={[box, { opacity: plate }]}>
          <Svg width={BW} height={BH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Circle cx="120" cy="100" r="78" fill={WARM} opacity={0.05} />
            <Circle cx="120" cy="100" r="60" fill={WARM} opacity={0.06} />
            <Circle cx="120" cy="100" r="42" fill={WARM} opacity={0.07} />
            <Ellipse cx="120" cy="150" rx="84" ry="7" fill="#000000" opacity={0.2} />
            <Ellipse cx="120" cy="144" rx="80" ry="10" fill="#F8FAFC" />
            <Ellipse cx="120" cy="145.5" rx="62" ry="6" fill="#E2E8F0" />
          </Svg>
        </Animated.View>

        {/* warm glow once the burger is complete */}
        <Animated.View style={[box, { opacity: glow }]}>
          <Svg width={BW} height={BH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Ellipse cx="120" cy="96" rx="66" ry="44" fill={WARM} opacity={0.35} />
          </Svg>
        </Animated.View>

        {/* fries (left) and a cold drink (right) pop up beside the plate */}
        <Animated.View style={[styles.abs, { left: box.left + 4 * k, top: sceneTop + 90 * k, width: 40 * k, height: 52 * k }, popStyle(0.24, -30 * k)]}>
          <Fries />
        </Animated.View>
        <Animated.View style={[styles.abs, { left: box.left + 198 * k, top: sceneTop + 88 * k, width: 36 * k, height: 56 * k }, popStyle(0.36, 30 * k)]}>
          <Soda />
        </Animated.View>

        {/* the burger, layer by layer (squashes as a whole when the top bun lands; bottom stays on the plate) */}
        <Animated.View
          style={[box, { transform: [{ translateY: 141 * k - BH / 2 }, { scaleY: squash }, { translateY: BH / 2 - 141 * k }] }]}
        >
          {LAYERS.map((l) => (
            <Animated.View key={l.key} style={[full, layerStyle(l.at)]}>
              <Svg width={BW} height={BH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
                {l.draw}
              </Svg>
            </Animated.View>
          ))}
        </Animated.View>

        {/* steam over the finished burger */}
        <Animated.View style={[box, { opacity: steam, transform: [{ translateY: steamY }] }]}>
          <Svg width={BW} height={BH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {[104, 120, 136].map((x, i) => (
              <Path
                key={x}
                d={`M${x} ${48 - (i % 2) * 4} q-6 -7 0 -14 q6 -7 0 -14 q-6 -7 0 -14`}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </Svg>
        </Animated.View>

        {/* sparkles bursting out as the top bun lands */}
        {SPARKS.map(([a, d, color], i) => {
          const rad = (a * Math.PI) / 180;
          const size = (i % 3 === 0 ? 7 : 5) * k;
          return (
            <Animated.View
              key={i}
              style={[
                styles.abs,
                {
                  left: burstX - size / 2,
                  top: burstY - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: color,
                  opacity: burstFade,
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * d * k] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * d * k] }) },
                    { scale: burst.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1.3, 0.6] }) },
                  ],
                },
              ]}
            />
          );
        })}

        {/* wordmark: exactly where the native splash drew it, then grows while it lifts */}
        <Animated.View
          style={[styles.center, { top: height / 2 - WORDMARK_H / 2, transform: [{ translateY: wordY }, { scale: wordScale }] }]}
        >
          <Image source={WORDMARK} style={{ width: WORDMARK_W, height: WORDMARK_H }} fadeDuration={0} />
        </Animated.View>

        <Animated.View style={[styles.center, { top: taglineTop, opacity: tagline, transform: [{ translateY: taglineY }] }]}>
          <View style={styles.taglineRow}>
            <View style={styles.dot} />
            <Text allowFontScaling={false} style={styles.tagline}>
              ORDER · EAT · REPEAT
            </Text>
            <View style={styles.dot} />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, zIndex: 10000, elevation: 10000, overflow: 'hidden' },
  abs: { position: 'absolute' },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  taglineRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FCD34D', marginHorizontal: 8 },
  tagline: {
    fontFamily: fonts.poppins,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.92)',
    includeFontPadding: false,
  },
});
