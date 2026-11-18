// Root layout: waits for the stored session (localStorage shim) before the first screen, then mounts the same
// providers the web's app/providers.jsx had (Redux store, toasts) plus the theme (web: html.dark from 'appTheme'),
// the native payment sheet (Razorpay) and the notification tap routing.
import React, { startTransition, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Provider as ReduxProvider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hydrateStorage } from '@/lib/storage';
import { RouteSync, navigateTo } from '@/lib/router';
import { routeFromNotification } from '@/lib/push';
import { ThemeProvider, brand } from '@/theme';
import { FontScope, Toaster } from '@/native/ui';
import { PaymentHost } from '@/native/PaymentHost';
import { AnimatedSplash, SPLASH_BG } from '@/native/AnimatedSplash';
import { markSplashDone } from '@/native/splashState';
import { preloadLoginImages } from '@/modules/auth/components/LoginImageSlider';
import { NavBarScrim } from '@/native/NavBarScrim';
import { store } from '@/appstore/store';
import AppShell from '@/appstore/AppShell';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Android fades the native splash out over 400 ms by default: the animated splash had to wait for it (or both wordmarks
// showed at once). Its first frame is the same picture, so a short fade is enough (18 Nov).
SplashScreen.setOptions({ duration: 150 });

function useNotificationRouting(ready) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !last) return;
    const route = routeFromNotification(last.notification);
    if (route) navigateTo(route);
  }, [ready, last]);
}

// tells the root once the app tree has been committed and drawn (one frame later)
function MountedSignal({ onMounted }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onMounted());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  return null;
}

export default function RootLayout() {
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    hydrateStorage().finally(() => {
      // signed out: the login banners start downloading now, while the splash plays
      if (!localStorage.getItem('user_accessToken')) preloadLoginImages('user');
      setStorageReady(true);
    });
  }, []);

  // the fonts are embedded in the app (expo-font plugin in app.json), so only the stored session is awaited
  const ready = storageReady;
  const [splashDone, setSplashDone] = useState(false);
  // Prince (18 Nov): mounting the app in the same render as the splash kept the JS thread busy ~0.8 s before the splash's
  // first frame (small native "Foodie" up ~2 s); mounting it right after the splash appeared made the wordmark wait for
  // smooth frames instead; mounting it during the burger build stalled the animation. Now the wordmark glides and the
  // burger is built on an idle thread, then the app mounts behind the finished burger and the splash leaves.
  const [appStart, setAppStart] = useState(false);
  const [appMounted, setAppMounted] = useState(false);
  useNotificationRouting(ready && appMounted); // the Stack (navigator) exists from then on

  const splash = splashDone ? null : (
    <AnimatedSplash
      ready={ready && appMounted}
      onShown={() => SplashScreen.hideAsync().catch(() => {})}
      onBuilt={() => startTransition(() => setAppStart(true))}
      onDone={() => {
        setSplashDone(true);
        markSplashDone();
      }}
    />
  );

  return (
    // one root for both states, so the splash (last child) is not remounted when the app becomes ready
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: ready ? brand.bootBg : SPLASH_BG }}>
      {ready && appStart ? (
        <SafeAreaProvider>
          <ReduxProvider store={store}>
            <ThemeProvider>
              {/* web global.css: font-family Poppins */}
              <FontScope family="Poppins">
                <RouteSync />
                <AppShell>
                  <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
                </AppShell>
                <NavBarScrim />
                <PaymentHost />
                <Toaster />
                <MountedSignal onMounted={() => setAppMounted(true)} />
              </FontScope>
            </ThemeProvider>
          </ReduxProvider>
        </SafeAreaProvider>
      ) : null}
      {splash}
    </GestureHandlerRootView>
  );
}
