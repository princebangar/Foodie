// App splash (native addition; the web's App.jsx splash is commented out). Foodie red, like the restaurant (cloche)
// and delivery (scooter) splashes have their own scene: the native splash (app.json: red with the white "Foodie"
// lettering) hands over to this screen at exactly the same size and place. When the app is ready:
//   - the red deepens into a gradient with a soft glow behind the name;
//   - "Foodie" grows and lifts, its smile is drawn again from left to right;
//   - food (pizza, coffee, ice-cream, cake, popcorn ...) pops out around the name and floats;
//   - "ORDER · EAT · REPEAT" slides in under it;
//   - then the food flies outwards, the name grows a little and the screen fades into the app.
// Same API as the other Foodie apps: ready / onShown / onDone, SPLASH_BG.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CakeSlice, Coffee, Cookie, Croissant, CupSoda, Donut, IceCreamCone, Pizza, Popcorn, Sandwich } from 'lucide-react-native';
import { Text } from '@/native/ui';
import { fonts } from '@/theme';

const WORD = require('../../assets/splash-word.png'); // white "Foodie" + leaf (550 x 257 canvas)
const SMILE = require('../../assets/splash-smile.png'); // the smile, same canvas
const WORD_RATIO = 257 / 550;
// app.json: the word canvas is 70 % of a 1024 image shown 240 dp wide
const NATIVE_W = 240 * 0.7;
const NATIVE_H = NATIVE_W * WORD_RATIO;

export const SPLASH_BG = '#B80B3D';
const RED_TOP = '#D0123F';
const RED_BOTTOM = '#8A0A2E';

const START_DELAY_MS = 380; // let the native splash fade out first
const ENTRANCE_MS = 950;
const HOLD_MS = 600;
const EXIT_MS = 520;
const MAX_WAIT_MS = 3000;

// food around the name: angle (deg, 0 = right), distance (x screen width), icon size, own rotation
const FOOD = [
  { Icon: Pizza, a: -150, d: 0.4, s: 40, r: -18 },
  { Icon: Coffee, a: -105, d: 0.36, s: 34, r: 10 },
  { Icon: IceCreamCone, a: -62, d: 0.38, s: 36, r: 16 },
  { Icon: Donut, a: -22, d: 0.42, s: 32, r: -8 },
  { Icon: Sandwich, a: 22, d: 0.4, s: 38, r: 12 },
  { Icon: CupSoda, a: 62, d: 0.38, s: 34, r: -14 },
  { Icon: CakeSlice, a: 105, d: 0.36, s: 36, r: 8 },
  { Icon: Popcorn, a: 150, d: 0.4, s: 34, r: -10 },
  { Icon: Croissant, a: 180, d: 0.44, s: 32, r: 20 },
  { Icon: Cookie, a: 0, d: 0.46, s: 28, r: -20 },
];

function FoodItem({ item, index, enter, exit, float, cx, cy, width }) {
  const rad = (item.a * Math.PI) / 180;
  const tx = Math.cos(rad) * item.d * width;
  const ty = Math.sin(rad) * item.d * width * 1.15;
  // each one pops a little after the previous
  const start = 0.18 + index * 0.05;
  const pop = enter.interpolate({ inputRange: [0, start, Math.min(1, start + 0.32), 1.0001], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' });
  const bob = float.interpolate({ inputRange: [0, 1], outputRange: index % 2 ? [-6, 6] : [6, -6] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - item.s / 2,
        top: cy - item.s / 2,
        width: item.s,
        height: item.s,
        opacity: Animated.multiply(Animated.multiply(pop, 0.9), exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
        transform: [
          { translateX: Animated.add(Animated.multiply(pop, tx), exit.interpolate({ inputRange: [0, 1], outputRange: [0, tx * 0.8] })) },
          { translateY: Animated.add(Animated.add(Animated.multiply(pop, ty), bob), exit.interpolate({ inputRange: [0, 1], outputRange: [0, ty * 0.8] })) },
          { scale: pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.2, 1.18, 1] }) },
          { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: [`${item.r * 3}deg`, `${item.r}deg`] }) },
        ],
      }}
    >
      <View style={styles.foodBubble}>
        <item.Icon size={item.s * 0.62} color="#FFFFFF" strokeWidth={2} />
      </View>
    </Animated.View>
  );
}

export function AnimatedSplash({ ready, onShown, onDone }) {
  const { width: W, height: H } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current; // 0 -> 1 entrance (native driver)
  const exit = useRef(new Animated.Value(0)).current; // 0 -> 1 exit (native driver)
  const float = useRef(new Animated.Value(0)).current; // food bobbing (native driver)
  const smile = useRef(new Animated.Value(1)).current; // visible part of the smile (JS driver: width)
  const shownRef = useRef(false);
  const startedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const targetW = Math.min(W * 0.6, 270);
  const grow = targetW / NATIVE_W;
  const lift = -Math.min(H * 0.06, 54);
  const cx = W / 2;
  const cy = H / 2 + lift;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // play the scene once the app is ready (or after MAX_WAIT_MS anyway); leave only when ready
  useEffect(() => {
    if (startedRef.current) return undefined;
    const timers = [];
    const begin = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      Animated.parallel([
        Animated.timing(enter, { toValue: 1, duration: ENTRANCE_MS, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(ENTRANCE_MS * 0.25),
          Animated.timing(smile, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(smile, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        ]),
      ]).start(() => {
        const finish = () =>
          Animated.timing(exit, { toValue: 1, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
            if (finished) onDoneRef.current?.();
          });
        const wait = () => setTimeout(readyRef.current ? finish : wait, readyRef.current ? HOLD_MS : 120);
        wait();
      });
    };
    timers.push(setTimeout(begin, ready ? START_DELAY_MS : MAX_WAIT_MS));
    return () => timers.forEach(clearTimeout);
  }, [ready, enter, exit, smile]);

  const wordScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [1, grow] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
  );
  const wordLift = enter.interpolate({ inputRange: [0, 1], outputRange: [0, lift] });
  const bg = enter.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' });
  const fadeAll = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const tagline = enter.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });
  const smileW = smile.interpolate({ inputRange: [0, 1], outputRange: [0, NATIVE_W] });

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fadeAll }]}
      onLayout={() => {
        if (shownRef.current) return;
        shownRef.current = true;
        onShown?.();
      }}
    >
      {/* deeper red + a soft glow behind the name */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bg }]}>
        <LinearGradient colors={[RED_TOP, SPLASH_BG, RED_BOTTOM]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy={`${(cy / H) * 100}%`} r="55%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.06} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={W} height={H} fill="url(#glow)" />
        </Svg>
      </Animated.View>

      {FOOD.map((item, i) => (
        <FoodItem key={i} item={item} index={i} enter={enter} exit={exit} float={float} cx={cx} cy={cy} width={W} />
      ))}

      {/* "Foodie": starts exactly where the native splash drew it */}
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={{ width: NATIVE_W, height: NATIVE_H, transform: [{ translateY: wordLift }, { scale: wordScale }] }}>
          <Image source={WORD} resizeMode="contain" style={StyleSheet.absoluteFill} />
          {/* the smile: whole at first (like the native splash), then drawn again from the left */}
          <Animated.View style={[styles.smileClip, { width: smileW }]}>
            <Image source={SMILE} resizeMode="contain" style={{ width: NATIVE_W, height: NATIVE_H }} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.taglineWrap,
          {
            top: cy + (targetW * WORD_RATIO) / 2 + 18,
            opacity: tagline,
            transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <Text style={styles.tagline}>ORDER · EAT · REPEAT</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, zIndex: 10000, elevation: 10000, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  smileClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  foodBubble: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  taglineWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tagline: { fontFamily: fonts.poppins, fontSize: 13, fontWeight: '600', letterSpacing: 4, color: 'rgba(255,255,255,0.92)' },
});
