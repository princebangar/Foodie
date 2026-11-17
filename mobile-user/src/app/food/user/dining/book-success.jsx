// /food/user/dining/book-success — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/dining/TableBookingSuccess';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
