// /food/user/orders — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/orders/Orders';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
