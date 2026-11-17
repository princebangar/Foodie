// /user/auth/* -> /user/auth/login (web: <Route path="*" element={<Navigate to="/user/auth/login" replace />} />)
import { Redirect } from 'expo-router';

export default function AuthCatchAll() {
  return <Redirect href="/user/auth/login" />;
}
