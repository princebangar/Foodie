// /food/user/profile/about — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/About';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
