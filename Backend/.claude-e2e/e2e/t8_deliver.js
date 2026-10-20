const { launch, newApp, shot, text, clickText, dragSlider, sleep, BASE } = require('./lib');
const { step, log } = require('./t2_order');
const { loginRider } = require('./t5_accept');
const ORDER = process.argv[2] || 'FOD-8903718';
(async () => {
  const browser = await launch();
  const d = await newApp(browser, 'rider', { lat: 22.7205, lng: 75.8710 });
  await step(d, '60-login', () => loginRider(d));
  await step(d, '61-online', async () => { await clickText(d, /^OFFLINE$/, { selector: 'button, div, span' }); await sleep(3000); });
  if (process.argv[3] !== 'skip') {
    await step(d, '62-orders', async () => { await clickText(d, /^Orders/, { selector: 'button, a, div' }); await sleep(3000); });
    await step(d, '63-open', async () => { await clickText(d, new RegExp(ORDER), { selector: 'button' }); await sleep(3000); });
    await step(d, '64-accept', async () => { await dragSlider(d, /^SLIDE TO ACCEPT$/i); await sleep(5000); });
  } else { await d.goto(BASE + '/food/delivery/feed', { waitUntil: 'networkidle2' }); await sleep(4000); }
  for (let i = 0; i < 6; i++) {
    const t = await text(d);
    const m = t.match(/^\s*(SLIDE TO [A-Z ]+|SWIPE TO PICK[A-Z ]*|COMPLETE DELIVERY)\s*$/im);
    if (!m) { console.log('no slider action found'); break; }
    await step(d, `65-${i}-${m[1].replace(/\s+/g, '_').slice(0, 24)}`, async () => { await dragSlider(d, new RegExp(`^${m[1]}$`, 'i')).catch(async () => clickText(d, new RegExp(m[1], 'i'), { selector: 'button' })); await sleep(4000); });
    if (/OTP|code|verify/i.test(await text(d))) break;
  }
  console.log('\nRIDER LOGS\n' + d.logs.filter((l) => !/Push API|WebSocket connection|45°/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
