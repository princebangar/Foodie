#!/usr/bin/env node
// Writes the thin Expo Router files under src/app/food/user/** from the web's UserRouter table
// (Frontend/src/modules/Food/components/user/UserRouter.jsx). Run once after changing the table:
//   node scripts/gen-routes.cjs
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'src', 'app', 'food', 'user');
const P = '@food/pages/user/';
// [web path, page module | special, guard, fallback]
const ROUTES = [
  ['profile/terms', 'profile/Terms', 'public', 'page'],
  ['profile/privacy', 'profile/Privacy', 'public', 'page'],
  ['profile/refund', 'profile/Refund', 'public', 'page'],
  ['profile/shipping', 'profile/Shipping', 'public', 'page'],
  ['profile/cancellation', 'profile/Cancellation', 'public', 'page'],
  ['profile/support', 'profile/Support', 'public', 'page'],
  ['profile/support-info', 'profile/UserCMSHelpSupportPage', 'public', 'page'],
  ['help', 'help/Help', 'public'],
  ['help/orders/[orderId]', 'help/OrderHelp', 'public'],
  ['auth/login', '#authLogin'],
  ['auth/sign-in', '#authLogin'],
  ['auth/otp', 'auth/OTP', 'auth'],
  ['auth/callback', 'auth/AuthCallback', 'public'],
  ['index', '#mainTab'],
  ['home', '#mainTab'],
  ['takeaway', '#mainTab'],
  ['dining/index', '#mainTab'],
  ['dining/[category]', 'DiningCategory', 'public'],
  ['dining/explore/upto50', 'DiningExplore50', 'public'],
  ['dining/explore/near-rated', 'DiningExploreNear', 'public'],
  ['dining/coffee', 'Coffee', 'public'],
  ['dining/[diningType]/[slug]', 'dining/DiningRestaurantDetails', 'public'],
  ['under-250', '#mainTab'],
  ['categories', 'Categories', 'public'],
  ['category/[category]', '#mainTab'],
  ['restaurants/index', 'restaurants/Restaurants', 'public'],
  ['restaurants/[slug]', 'restaurants/RestaurantDetails', 'public'],
  ['search', 'search/ProfessionalSearch', 'public'],
  ['product/[id]', 'ProductDetail', 'public'],
  ['address-selector', 'cart/AddressSelectorPage', 'public'],
  ['dining/book/[slug]', 'dining/TableBooking', 'user'],
  ['dining/book-confirmation', 'dining/TableBookingConfirmation', 'user'],
  ['dining/book-success', 'dining/TableBookingSuccess', 'user'],
  ['dining/modification-policy', 'dining/TableModificationPolicy', 'user'],
  ['dining/cancellation-policy', 'dining/TableCancellationPolicy', 'user'],
  ['dining/edit-user', 'dining/TableEditUserPage', 'user'],
  ['bookings', 'dining/MyBookings', 'user'],
  ['cart/index', 'cart/Cart', 'user'],
  ['cart/checkout', 'cart/Checkout', 'user'],
  ['cart/select-address', 'cart/SelectAddress', 'user'],
  ['orders/index', 'orders/Orders', 'user'],
  ['orders/[orderId]/index', 'orders/OrderTracking', 'user'],
  ['orders/[orderId]/invoice', 'orders/OrderInvoice', 'user'],
  ['orders/[orderId]/details', 'orders/UserOrderDetails', 'user'],
  ['offers', 'Offers', 'user'],
  ['gourmet', 'Gourmet', 'user'],
  ['collections/index', 'Collections', 'user'],
  ['collections/[id]', 'CollectionDetail', 'user'],
  ['profile/index', '#mainTabUser'],
  ['profile/edit', 'profile/EditProfile', 'user'],
  ['profile/payments/index', 'profile/Payments', 'user'],
  ['profile/payments/new', 'profile/AddPayment', 'user'],
  ['profile/payments/[id]/edit', 'profile/EditPayment', 'user'],
  ['profile/favorites', 'profile/Favorites', 'user'],
  ['profile/coupons', 'profile/Coupons', 'user'],
  ['profile/about', 'profile/About', 'user'],
  ['profile/report-safety-emergency', 'profile/ReportSafetyEmergency', 'user'],
  ['profile/delivery-safety', 'profile/DeliverySafety', 'user'],
  ['profile/accessibility', 'profile/Accessibility', 'user'],
  ['profile/logout', 'profile/Logout', 'user'],
  ['profile/refer-earn', 'profile/ReferEarn', 'user'],
  ['diamond/index', 'diamond/DiamondPage', 'user'],
  ['diamond/terms', 'diamond/DiamondTerms', 'user'],
  ['diamond/support', 'diamond/DiamondSupport', 'user'],
  ['profile/dining-bookings', 'dining/MyBookings', 'user'],
  ['profile/settings', 'profile/Settings', 'user', 'loader'],
  ['notifications', 'Notifications', 'user'],
  ['wallet', 'Wallet', 'user'],
  ['complaints/submit/[orderId]', 'complaints/SubmitComplaint', 'user'],
  ['login', '#authLogin'],
];

const webPath = (p) => '/food/user/' + p.replace(/(^|\/)index$/, '').replace(/\[(\w+)\]/g, ':$1');
const opts = (fb) => (fb ? `, { fallback: '${fb}' }` : '');

fs.rmSync(APP, { recursive: true, force: true });
for (const [p, mod, guard, fb] of ROUTES) {
  const url = webPath(p).replace(/\/$/, '');
  let body;
  if (mod === '#authLogin') {
    body = `// ${url} — web: <AuthRedirect module="user"><Navigate to="/user/auth/login" replace /></AuthRedirect>\nexport { AuthLoginRedirect as default } from '@food/components/user/UserRouter';\n`;
  } else if (mod.startsWith('#mainTab')) {
    const g = mod === '#mainTabUser' ? 'protectedRoute' : 'publicRoute';
    body = `// ${url} — main tab: drawn by MainTabKeepAlive in UserLayout; the route only matches (web: MainTabRoutePlaceholder).\nimport { MainTabRoutePlaceholder, ${g} } from '@food/components/user/UserRouter';\n\nexport default ${g}(MainTabRoutePlaceholder);\n`;
  } else if (guard === 'auth') {
    body = `// ${url} — web: <AuthRedirect module="user"><Page /></AuthRedirect>\nimport React from 'react';\nimport Page from '${P}${mod}';\nimport AuthRedirect from '@food/components/AuthRedirect';\nimport { publicRoute } from '@food/components/user/UserRouter';\n\nfunction GuestOnly(props) {\n  return (\n    <AuthRedirect module="user">\n      <Page {...props} />\n    </AuthRedirect>\n  );\n}\n\nexport default publicRoute(GuestOnly);\n`;
  } else {
    const g = guard === 'user' ? 'protectedRoute' : 'publicRoute';
    const note = guard === 'user' ? 'login required (ProtectedRoute requiredRole="user" loginPath="/user/auth/login")' : 'open to guests';
    body = `// ${url} — ${note}\nimport Page from '${P}${mod}';\nimport { ${g} } from '@food/components/user/UserRouter';\n\nexport default ${g}(Page${opts(fb)});\n`;
  }
  const file = path.join(APP, p + '.jsx');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}
console.log(`${ROUTES.length} route files written`);
