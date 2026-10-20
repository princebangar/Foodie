const { launch, newApp, shot, text, clickText, typeInto, otp, sleep, BASE } = require('./lib');
const PHONE = '8962843670';
const log = async (p, label) => {
  await shot(p, label);
  console.log(`\n=== ${p.appName}:${label} @ ${p.url().replace(BASE, '')}\n` + (await text(p)).replace(/\n+/g, ' | ').slice(0, 700));
};
const step = async (p, label, fn) => {
  try { await fn(); } catch (e) { console.log(`!! ${p.appName}:${label}: ${e.message}`); }
  await sleep(1200);
  await log(p, label);
};

async function loginUser(u) {
  await u.goto(`${BASE}/user/auth/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await typeInto(u, 'input[placeholder="Mobile number"]', PHONE);
  await clickText(u, /^Log in$/, { selector: 'button' });
  await sleep(1500); await otp(u); await sleep(500);
  await clickText(u, /Verify & Continue/, { selector: 'button' }).catch(() => {});
  await sleep(5000);
}
async function loginRestaurant(r) {
  await r.goto(`${BASE}/food/restaurant/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await typeInto(r, 'input[placeholder="Mobile number"]', PHONE);
  await clickText(r, /^Log in$/, { selector: 'button' });
  await sleep(2000); await otp(r); await sleep(500);
  await clickText(r, /Verify & Continue/, { selector: 'button' }).catch(() => {});
  await sleep(7000);
}

module.exports = { loginUser, loginRestaurant, step, log, PHONE };

if (require.main === module) (async () => {
  const browser = await launch();
  const r = await newApp(browser, 'rest');
  const u = await newApp(browser, 'user');
  await step(r, '01-login', () => loginRestaurant(r));
  await step(u, '01-login', () => loginUser(u));
  await step(u, '02-restaurant', async () => { await u.goto(`${BASE}/food/user/restaurants/the-prince-restro`, { waitUntil: 'networkidle2' }); await sleep(3000); });
  await step(u, '03-add', async () => { await clickText(u, /^ADD\s*\+?$/, { selector: "button" }); await sleep(2000); });
  await step(u, '04-add-more', async () => { await clickText(u, /Add item|Add to cart|ADD ITEM|Add ₹/i, { selector: 'button' }).catch(() => {}); await sleep(1500); });
  await step(u, '05-cart', async () => { await u.goto(`${BASE}/food/user/cart`, { waitUntil: 'networkidle2' }); await sleep(3000); });
  console.log('\nREST LOGS\n' + r.logs.slice(0, 25).join('\n'));
  console.log('\nUSER LOGS\n' + u.logs.filter((l) => !/Push API/.test(l)).slice(0, 25).join('\n'));
  await browser.close();
})();
