// /food/user/orders/:orderId — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/orders/OrderTracking';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
