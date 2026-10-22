// Reorganise Foodie frontend media: git mv/rm files and rewrite references in source.
// Usage: node restructure.js <FrontendRoot> [--dry]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = process.argv[2]; const dry = process.argv.includes('--dry');
const A = 'src/modules/Food/assets';
const git = (...args) => { if (dry) { console.log('git', args.join(' ')); return; } execFileSync('git', ['-C', root, ...args], { stdio: 'inherit' }); };

// [oldPathRelToFrontend, newPathRelToFrontend, [reference rewrites: [oldString, newString]]]
const moves = [
  // ---- bundled assets (imported through @food/assets/...) ----
  ...['accepted', 'canceled', 'delivered', 'on-the-way', 'payment-failed', 'pending', 'processing', 'refunded', 'scheduled'].map((n) =>
    [`${A}/Dashboard-icons/${n}.svg`, `${A}/admin/order-report-icons/${n}.svg`, [[`@food/assets/Dashboard-icons/${n}.svg`, `@food/assets/admin/order-report-icons/${n}.svg`]]]),
  [`${A}/Dashboard-icons/image8.png`, `${A}/admin/order-report-icons/search.png`, [['@food/assets/Dashboard-icons/image8.png', '@food/assets/admin/order-report-icons/search.png']]],
  [`${A}/Dashboard-icons/image9.png`, `${A}/admin/order-report-icons/export.png`, [['@food/assets/Dashboard-icons/image9.png', '@food/assets/admin/order-report-icons/export.png']]],
  ...['trx1.png', 'trx3.png', 'trx5.png', 'trx1.svg', 'trx3.svg', 'admin-earning.svg', 'deliveryman-earning.svg', 'store-earning.svg'].map((n) =>
    [`${A}/Transaction-report-icons/${n}`, `${A}/admin/transaction-icons/${n}`, [[`@food/assets/Transaction-report-icons/${n}`, `@food/assets/admin/transaction-icons/${n}`]]]),
  ...['mobile_image1.png', 'mobile_image2.png'].map((n) =>
    [`${A}/Transaction-report-icons/${n}`, `${A}/admin/theme-previews/${n}`, [[`@food/assets/Transaction-report-icons/${n}`, `@food/assets/admin/theme-previews/${n}`]]]),
  ...['collectionspagebanner.png', 'gourmet_new_banner.png', 'home-banner-red-clean.png', 'under250_banner.jpg', 'offerimage.png'].map((n) =>
    [`${A}/${n}`, `${A}/banners/${n}`, [[`@food/assets/${n}`, `@food/assets/banners/${n}`]]]),
  [`${A}/offerpagebanner.svg`, `${A}/banners/offerpagebanner.svg`, [['../../assets/offerpagebanner.svg', '@food/assets/banners/offerpagebanner.svg'], ['@food/assets/offerpagebanner.svg', '@food/assets/banners/offerpagebanner.svg']]],
  [`${A}/takeaway_burger.png`, `${A}/illustrations/takeaway_burger.png`, [['@food/assets/takeaway_burger.png', '@food/assets/illustrations/takeaway_burger.png']]],
  [`${A}/Outofzone_bg.jpg`, `${A}/illustrations/out-of-zone-bg.jpg`, [['@food/assets/Outofzone_bg.jpg', '@food/assets/illustrations/out-of-zone-bg.jpg']]],
  [`${A}/maintenance/maintenance-hero.png`, `${A}/illustrations/maintenance-hero.png`, [['@food/assets/maintenance/maintenance-hero.png', '@food/assets/illustrations/maintenance-hero.png']]],
  [`${A}/bikelogo.png`, `${A}/map/bikelogo.png`, [['@food/assets/bikelogo.png', '@food/assets/map/bikelogo.png']]],
  [`${A}/dish_fallback.webp`, `${A}/placeholders/dish_fallback.webp`, [['@food/assets/dish_fallback.webp', '@food/assets/placeholders/dish_fallback.webp']]],
  ...['discount_promo.png', 'price_promo.png', 'veg_promo.png'].map((n) =>
    [`${A}/category-icons/${n}`, `${A}/promo-icons/${n}`, [[`@food/assets/category-icons/${n}`, `@food/assets/promo-icons/${n}`]]]),
  [`${A}/explore more icons/offers.png`, `${A}/explore-icons/offers.png`, []],
  // ---- public files (referenced by URL) ----
  ...['burger-real.png', 'dish-img.png', 'pizza-free.png', 'restaurant-food.jpg', 'hero-bg-trim.mp4'].map((n) =>
    [`public/${n}`, `public/landing/${n}`, [[`"/${n}"`, `"/landing/${n}"`], [`'/${n}'`, `'/landing/${n}'`], [`(/${n})`, `(/landing/${n})`]]]),
  ['public/phone screen 1.webp', 'public/landing/phone-screen-1.webp', [['"/phone screen 1.webp"', '"/landing/phone-screen-1.webp"']]],
  ['public/playstore_img-removebg-preview.webp', 'public/landing/playstore-badge.webp', [['"/playstore_img-removebg-preview.webp"', '"/landing/playstore-badge.webp"']]],
  ['public/redgo-logo-footer.jpeg', 'public/landing/footer-logo.jpeg', [['"/redgo-logo-footer.jpeg"', '"/landing/footer-logo.jpeg"']]],
  ['public/offers.png', 'public/landing/offers.png', [['"/offers.png"', '"/landing/offers.png"']]],
  ['public/MapRider.png', 'public/images/map/rider.png', [['"/MapRider.png"', '"/images/map/rider.png"']]],
  ['public/cutlery_icon.webp', 'public/images/map/restaurant-marker.webp', [["'/cutlery_icon.webp'", "'/images/map/restaurant-marker.webp'"]]],
  ['public/profile_avatar.webp', 'public/images/profile-avatar.webp', [['"/profile_avatar.webp"', '"/images/profile-avatar.webp"'], ["'/profile_avatar.webp'", "'/images/profile-avatar.webp'"]]],
  ['public/fssai.png', 'public/images/fssai.png', [['"/fssai.png', '"/images/fssai.png']]],
  ['public/adminloginpagedesign.webp', 'public/images/admin-login-bg.webp', [['"/adminloginpagedesign.webp"', '"/images/admin-login-bg.webp"']]],
];

// Files deleted outright (unused, duplicates, wrong brand, or unrecoverably damaged and replaced).
const deletes = [
  'public/playstore-icon.png', 'public/roadside-restaurant.jpg', 'public/vite.svg',
  'public/Driver_logo_1.png', 'public/Driver_logo_2.png', 'public/Restaurant_logo_1.png', 'public/Restaurant_logo_2.png',
  'public/food_dish.png', 'public/food_dish_2.png',
  'public/redgo_logo_transparent.png', 'public/assets/images/redgo-toast-logo.png', 'public/alert.mp3',
  'src/assets/logo.png',
  `${A}/appzetologo.png`, `${A}/audio/alert.mp3`, `${A}/audio/original.mp3`, `${A}/audio/zomato_sms.mp3`, `${A}/circleicon.png`,
  ...[1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].map((n) => `${A}/Dashboard-icons/image${n}.png`),
  `${A}/Dashboard-icons/most-popular.png`, `${A}/fssai.png`, `${A}/groumetpagebanner.png`, `${A}/home-banner-red.png`, `${A}/logo.png`,
  `${A}/offerpagebanner.png`, `${A}/quick-favicon.png`, `${A}/quicky-spicy-logo.png`, `${A}/react.svg`, `${A}/referralbonuscardbg.png`,
  ...['loginbanner1.png', 'loginbanner2.png', 'loginbanner3.png', 'loginbanner4.png', 'restaurant_dark_red_bg.png', 'restaurant_login_bg.png', 'restaurant_red_bg.png'].map((n) => `${A}/restaurant/${n}`),
  `${A}/tiptransfericon.png`, `${A}/top10pagebanner.png`,
  ...['admin-earning.png', 'deliveryman-earning.png', 'store-earning.png'].map((n) => `${A}/Transaction-report-icons/${n}`),
  `${A}/explore more icons/gift catrd.png`, `${A}/explore more icons/top 10.png`, `${A}/explore more icons/collection.png`, `${A}/explore more icons/gourmet.png`,
  `${A}/deliveryloginbanner.png`, `${A}/loginbanner.png`,
];

// Plain string rewrites that are not tied to a moved file.
const extraRewrites = [
  ['"/redgo_logo_transparent.png"', '"/logo.png"'],
  ['"/assets/images/redgo-toast-logo.png"', '"/logo.png"'],
  ['"/alert.mp3"', '"/restaurant_alert.mp3"'],
];

for (const [from, to] of moves) {
  if (!fs.existsSync(path.join(root, from))) { console.log('MISSING (skip move)', from); continue; }
  if (!dry) fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
  git('mv', from, to);
}
for (const f of deletes) {
  if (!fs.existsSync(path.join(root, f))) { console.log('MISSING (skip delete)', f); continue; }
  git('rm', '-q', f);
}

const rewrites = [...moves.flatMap(([, , r]) => r), ...extraRewrites];
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'dist'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(jsx?|tsx?|css|html)$/.test(e.name)) acc.push(p); } return acc; }
const targets = [...walk(path.join(root, 'src'), []), path.join(root, 'index.html')];
let changedFiles = 0;
for (const f of targets) {
  const before = fs.readFileSync(f, 'utf8'); let after = before;
  for (const [a, b] of rewrites) after = after.split(a).join(b);
  if (after !== before) { changedFiles++; console.log('rewrote', path.relative(root, f)); if (!dry) fs.writeFileSync(f, after); }
}
console.log('files rewritten:', changedFiles);
