// Root layout: waits for the stored session (localStorage shim) before the first screen, then mounts the same
// providers the web's app/providers.jsx had (Redux store, toasts) plus the theme (web: html.dark from 'appTheme'),
// the native payment sheet (Razorpay) and the notification tap routing.
import React, { useEffect, useState } from 'react';
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
import { NavBarScrim } from '@/native/NavBarScrim';
import { store } from '@/appstore/store';
import AppShell from '@/appstore/AppShell';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useNotificationRouting(ready) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !last) return;
    const route = routeFromNotification(last.notification);
    if (route) navigateTo(route);
  }, [ready, last]);
}

export default function RootLayout() {
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    hydrateStorage().finally(() => setStorageReady(true));
  }, []);

  // the fonts are embedded in the app (expo-font plugin in app.json), so only the stored session is awaited
  const ready = storageReady;
  const [splashDone, setSplashDone] = useState(false);
  useNotificationRouting(ready);

  const splash = splashDone ? null : (
    <AnimatedSplash
      ready={ready}
      onShown={() => SplashScreen.hideAsync().catch(() => {})}
      onDone={() => {
        setSplashDone(true);
        markSplashDone();
      }}
    />
  );

  return (
    // one root for both states, so the splash (last child) is not remounted when the app becomes ready
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: ready ? brand.bootBg : SPLASH_BG }}>
      {ready ? (
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
              </FontScope>
            </ThemeProvider>
          </ReduxProvider>
        </SafeAreaProvider>
      ) : null}
      {splash}
    </GestureHandlerRootView>
  );
}
