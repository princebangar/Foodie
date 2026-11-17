// /food/user/dining/modification-policy — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/dining/TableModificationPolicy';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
