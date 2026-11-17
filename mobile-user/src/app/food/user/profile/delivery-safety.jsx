// /food/user/profile/delivery-safety — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/DeliverySafety';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
