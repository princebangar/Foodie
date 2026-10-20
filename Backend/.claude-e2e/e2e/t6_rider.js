const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { loginRestaurant, step, log } = require('./t2_order');
const { slideAccept, loginRider } = require('./t5_accept');
(async () => {
  const browser = await launch();
  const d = await newApp(browser, 'rider', { lat: 22.7205, lng: 75.8710 });
  const r = await newApp(browser, 'rest');
  await step(d, '40-login', () => loginRider(d));
  await step(d, '41-online', async () => { await clickText(d, /^OFFLINE$/, { selector: 'button, div, span' }); await sleep(4000); });
  await step(r, '42-login', () => loginRestaurant(r));
  await sleep(3000);
  await step(r, '43-accept', async () => { await slideAccept(r); await sleep(3000); });
  // rider incoming request
  let got = false;
  for (let i = 0; i < 25 && !got; i++) { got = /incoming|new order|accept|FOD-/i.test(await text(d)); if (!got) await sleep(1000); }
  await log(d, '44-incoming');
  const riderPlays = await d.evaluate(() => window.__plays.map((p) => p.src.split('/').pop()));
  console.log('RIDER PLAYS', riderPlays.length, [...new Set(riderPlays)]);
  console.log('\nRIDER LOGS\n' + d.logs.filter((l) => !/Push API|WebSocket connection|45°/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
