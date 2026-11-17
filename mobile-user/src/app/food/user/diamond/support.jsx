// /food/user/diamond/support — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/diamond/DiamondSupport';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
