// /food/user/wallet — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/Wallet';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
