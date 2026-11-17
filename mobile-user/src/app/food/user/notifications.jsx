// /food/user/notifications — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/Notifications';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
