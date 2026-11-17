// /food/user/dining/book/:slug — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/dining/TableBooking';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
