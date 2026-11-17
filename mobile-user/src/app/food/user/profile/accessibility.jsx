// /food/user/profile/accessibility — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/Accessibility';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
