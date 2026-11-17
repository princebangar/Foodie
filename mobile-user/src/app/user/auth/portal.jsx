// /user/auth/portal -> /food/user (web: <Navigate to="/food/user" replace />)
import { Redirect } from 'expo-router';

export default function PortalRedirect() {
  return <Redirect href="/food/user" />;
}
