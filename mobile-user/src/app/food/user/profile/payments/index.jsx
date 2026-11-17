// /food/user/profile/payments — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/Payments';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
