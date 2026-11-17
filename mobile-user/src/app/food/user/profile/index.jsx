// /food/user/profile — main tab: drawn by MainTabKeepAlive in UserLayout; the route only matches (web: MainTabRoutePlaceholder).
import { MainTabRoutePlaceholder, protectedRoute } from '@food/components/user/UserRouter';

export default protectedRoute(MainTabRoutePlaceholder);
