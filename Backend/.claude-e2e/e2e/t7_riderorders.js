const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { step, log } = require('./t2_order');
const { loginRider } = require('./t5_accept');
(async () => {
  const browser = await launch();
  const d = await newApp(browser, 'rider', { lat: 22.7205, lng: 75.8710 });
  await step(d, '50-login', () => loginRider(d));
  await sleep(5000);
  await log(d, '51-feed');
  await step(d, '52-orders', async () => { await clickText(d, /^Orders/, { selector: 'button, a, div' }); await sleep(3000); });
  console.log('\nRIDER LOGS\n' + d.logs.filter((l) => !/Push API|WebSocket connection|45°/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
