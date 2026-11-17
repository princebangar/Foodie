// /food/user/complaints/submit/:orderId — login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")
import Page from '@food/pages/user/complaints/SubmitComplaint';
import { protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(Page);
