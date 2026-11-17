// /food/user/profile/terms — open to guests
import Page from '@food/pages/user/profile/Terms';
import { publicRoute } from '@food/components/user/UserRouter';

export default publicRoute(Page, { fallback: 'page' });
