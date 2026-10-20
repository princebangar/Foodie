const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { loginUser, step, log } = require('./t2_order');
(async () => {
  const browser = await launch();
  const u = await newApp(browser, 'user');
  await step(u, 'a0-login', () => loginUser(u));
  await u.goto(`${BASE}/food/user/restaurants/the-prince-restro`, { waitUntil: 'networkidle2' }); await sleep(2500);
  await clickText(u, /^ADD\s*\+?$/, { selector: 'button' }).catch(() => {}); await sleep(1500);
  await u.goto(`${BASE}/food/user/cart`, { waitUntil: 'networkidle2' }); await sleep(3000);
  await step(u, 'a1-chip-work', async () => { await clickText(u, /^\+?\s*Work$/, { selector: 'button, div, span' }); await sleep(2500); });
  await step(u, 'a2-back', async () => { await u.goBack(); await sleep(2500); });
  console.log('BACK RETURNED TO CART?', u.url().includes('/cart'));
  await step(u, 'a3-under250', async () => { await u.goto(`${BASE}/food/user/under-250`, { waitUntil: 'networkidle2' }); await sleep(6000); });
  await step(u, 'a4-about', async () => { await u.goto(`${BASE}/food/user/profile/about`, { waitUntil: 'networkidle2' }); await sleep(3000); });
  const about = await text(u);
  console.log('ABOUT FOOTER:', (about.match(/.{0,10}20\d\d.{0,40}/) || [])[0]);
  console.log('\nUSER LOGS\n' + u.logs.filter((l) => !/Push API|WebSocket|deprecated/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
