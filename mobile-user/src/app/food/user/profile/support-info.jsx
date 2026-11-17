// /food/user/profile/support-info — open to guests
import Page from '@food/pages/user/profile/UserCMSHelpSupportPage';
import { publicRoute } from '@food/components/user/UserRouter';

export default publicRoute(Page, { fallback: 'page' });
