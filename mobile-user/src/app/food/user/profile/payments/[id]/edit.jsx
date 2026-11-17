// /food/user/profile/payments/:id/edit — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/EditPayment';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
