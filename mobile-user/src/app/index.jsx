// App start: the Food home. A signed-out visitor is then sent to /user/auth/login by RequireInitialAuth.
// Prince (18 Nov): the app used to reopen the last /food/user route it showed (web resolveNativeInitialRoute,
// native_last_route) - after killing the app from recents it came back on Dining / a restaurant instead of starting
// fresh. A cold start now always opens Home. (AppShell still writes native_last_route; nothing reads it.)
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/food/user" />;
}
