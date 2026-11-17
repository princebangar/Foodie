// /food/user/diamond — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/diamond/DiamondPage';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
