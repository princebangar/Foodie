// What the web mounted around every screen (Frontend/src/index.jsx, app/App.jsx, app/routes.jsx AppRoutes):
//  - index.jsx: business settings load, the native API error bridge (dark mode from 'appTheme' = src/theme ThemeProvider);
//  - AppRoutes: the last /food/... route is remembered for the next cold start (native_last_route, read by src/app/index.jsx);
//  - MaintenanceGate around the routes (here an overlay above every screen);
//  - the sonner <Toaster> (root layout) and, native only, the default status bar and the offline notice.
// The splash of App.jsx is commented out on the web; the app has its own native splash (src/native/AnimatedSplash).
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocation } from '@/lib/router';
import '@/shared/utils/toastGuard';
import StatusBarSync from './StatusBarSync';
import ConnectionStatus from './ConnectionStatus';
import MaintenanceGate from './MaintenanceGate';
import { installNativeApiErrorBridge } from '@/shared/utils/apiError';
import { FlyToCartHost } from '@food/utils/flyToCart';

const NATIVE_LAST_ROUTE_KEY = 'native_last_route';

import('@food/utils/businessSettings')
  .then(({ loadBusinessSettings }) => loadBusinessSettings())
  .catch(() => {});
installNativeApiErrorBridge();

function AppWatchers() {
  const location = useLocation();
  useEffect(() => {
    const route = `${location.pathname || ''}${location.search || ''}`;
    if (route.startsWith('/food/')) localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route);
  }, [location.pathname, location.search]);

  return (
    <>
      <StatusBarSync />
      <ConnectionStatus />
    </>
  );
}

export default function AppShell({ children }) {
  return (
    <View style={styles.fill}>
      <AppWatchers />
      {children}
      {/* web flyToCart(): the dish photo flying into the cart pill, above every screen */}
      <FlyToCartHost />
      <MaintenanceGate />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
