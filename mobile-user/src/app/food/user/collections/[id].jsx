// /food/user/collections/:id — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/CollectionDetail';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
