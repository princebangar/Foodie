// /food/user/diamond/terms — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/diamond/DiamondTerms';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
