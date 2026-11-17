// /food/user/profile/refer-earn — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/profile/ReferEarn';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
