// /food/user/profile/privacy — open to guests
import Page from '@food/pages/user/profile/Privacy';
import { publicRoute } from '@food/components/user/UserRouter';

export default publicRoute(Page, { fallback: 'page' });
