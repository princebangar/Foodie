// The web router's catch-all (/*) renders the Food user app: an unknown address opens the Food home, which itself
// sends a signed-out visitor to /user/auth/login (RequireInitialAuth).
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/food/user" />;
}
