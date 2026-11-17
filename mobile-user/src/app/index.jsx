// App start (web index.jsx resolveNativeInitialRoute inside the app shell): the last /food/user route the app showed,
// otherwise the Food home. A signed-out visitor is then sent to /user/auth/login by RequireInitialAuth.
import { Redirect } from 'expo-router';

const NATIVE_LAST_ROUTE_KEY = 'native_last_route';

function initialRoute() {
  const stored = String(localStorage.getItem(NATIVE_LAST_ROUTE_KEY) || '').trim();
  if (stored.startsWith('/food/user')) return stored;
  return '/food/user';
}

export default function Index() {
  return <Redirect href={initialRoute()} />;
}
