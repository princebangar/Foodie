const { launch, newApp, shot, text, clickText, otp, sleep, BASE, dragSlider } = require('./lib');
const { loginUser, step, log } = require('./t2_order');
const { loginRider } = require('./t5_accept');
const ORDER = process.argv[2] || 'FOD-8903718';
const CODE = process.argv[3] || '7066';
const slideAny = async (d) => {
  const m = (await text(d)).match(/^\s*(SLIDE TO [A-Z ]+)\s*$/im);
  if (!m) return false;
  await dragSlider(d, new RegExp(`^${m[1]}$`, 'i'));
  return m[1];
};
(async () => {
  const browser = await launch();
  const u = await newApp(browser, 'user');
  const d = await newApp(browser, 'rider', { lat: 22.7205, lng: 75.8710 });
  await step(u, '70-login', () => loginUser(u));
  await step(u, '71-orders', async () => { await u.goto(`${BASE}/food/user/orders`, { waitUntil: 'networkidle2' }); await sleep(3000); });
  await step(u, '72-track', async () => { await clickText(u, /^View Details$/, { selector: 'button, a, span, div' }); await sleep(4000); });
  console.log('USER SEES CODE?', (await text(u)).includes(CODE));
  await step(d, '73-login', () => loginRider(d));
  await d.goto(`${BASE}/food/delivery/feed`, { waitUntil: 'networkidle2' }); await sleep(4000);
  await step(d, '74-verify', async () => { await clickText(d, /VERIFY & COMPLETE/i, { selector: 'button' }); await sleep(2000); });
  await step(d, '75-wrong', async () => { await otp(d, '9999'); await sleep(500); console.log('slid', await slideAny(d)); await sleep(2500); });
  const wrongState = await d.evaluate(() => [...document.querySelectorAll('input')].filter((i) => i.offsetParent).map((i) => `${i.getAttribute('aria-invalid')}|${getComputedStyle(i).borderColor}`));
  console.log('WRONG CODE INPUT STATE', wrongState);
  await step(d, '76-right', async () => {
    const inputs = await d.$$('input');
    for (const i of inputs) { const vis = await i.evaluate((e) => !!e.offsetParent); if (vis) { await i.click({ clickCount: 3 }).catch(() => {}); await d.keyboard.press('Backspace'); } }
    const first = await d.$('input');
    if (first) await first.click();
    await otp(d, CODE); await sleep(500);
    console.log('slid', await slideAny(d));
    await sleep(3000);
  });
  await step(d, '77-cash', async () => { await clickText(d, /cash/i, { selector: 'button, div' }).catch(() => {}); await sleep(1500); console.log('slid', await slideAny(d)); await sleep(4000); });
  await step(d, '78-after', async () => { const s = await slideAny(d); if (!s) await clickText(d, /^(Complete|Confirm|Done|Submit)/i, { selector: 'button' }).catch(() => {}); await sleep(4000); });
  await log(u, '79-user-after');
  console.log('\nRIDER LOGS\n' + d.logs.filter((l) => !/Push API|WebSocket connection|45°|Marker is deprecated/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
