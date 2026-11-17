// /food/user/offers — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/Offers';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
