const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { loginUser, loginRestaurant, step, log } = require('./t2_order');
(async () => {
  const browser = await launch();
  const r = await newApp(browser, 'rest');
  const u = await newApp(browser, 'user');
  await step(r, '10-login', () => loginRestaurant(r));
  await step(u, '10-login', () => loginUser(u));
  await step(u, '11-restaurant', async () => { await u.goto(`${BASE}/food/user/restaurants/the-prince-restro`, { waitUntil: 'networkidle2' }); await sleep(2500); });
  await step(u, '12-add', async () => { await clickText(u, /^ADD\s*\+?$/, { selector: 'button' }); await sleep(1500); });
  await step(u, '13-cart', async () => { await u.goto(`${BASE}/food/user/cart`, { waitUntil: 'networkidle2' }); await sleep(3000); });
  const playsBefore = await r.evaluate(() => window.__plays.length);
  const t0 = Date.now();
  await step(u, '14-place', async () => { await clickText(u, /Place Order/, { selector: 'button' }); await sleep(6000); });
  // restaurant popup + ring
  let popupAt = null;
  for (let i = 0; i < 20; i++) {
    const t = await text(r);
    if (/new order|accept/i.test(t) && /FOD-|order/i.test(t)) { popupAt = Date.now() - t0; break; }
    await sleep(1000);
  }
  await log(r, '15-popup');
  const plays1 = await r.evaluate(() => window.__plays.length);
  await sleep(10000);
  const plays2 = await r.evaluate(() => window.__plays.map((p) => p.src.split('/').pop()));
  console.log(`\nRING: popupAfterMs=${popupAt} playsBefore=${playsBefore} playsAtPopup=${plays1} playsAfter10s=${plays2.length} srcs=${[...new Set(plays2)].join(',')}`);
  await log(u, '16-user-tracking');
  console.log('\nREST LOGS\n' + r.logs.filter((l) => !/Push API/.test(l)).slice(0, 25).join('\n'));
  console.log('\nUSER LOGS\n' + u.logs.filter((l) => !/Push API/.test(l)).slice(0, 25).join('\n'));
  await browser.close();
})();
