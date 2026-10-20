const { launch, newApp, shot, text, clickText, typeInto, otp, sleep, BASE } = require('./lib');
const { loginRestaurant, step, log, PHONE } = require('./t2_order');

async function slideAccept(r) {
  // drag the round handle inside the "Slide to accept" track to the right end
  const box = await r.evaluate(() => {
    const label = [...document.querySelectorAll('span')].find((s) => /Slide to accept/i.test(s.innerText));
    if (!label) return null;
    const track = label.closest('div.relative') || label.parentElement.parentElement;
    const handle = track.querySelector('button');
    const t = track.getBoundingClientRect();
    const h = (handle || track).getBoundingClientRect();
    return { hx: h.left + h.width / 2, hy: h.top + h.height / 2, tx: t.right - 8 };
  });
  if (!box) throw new Error('slider not found');
  await r.mouse.click(box.hx, box.hy);
}

async function loginRider(d) {
  await d.goto(`${BASE}/food/delivery/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await typeInto(d, 'input[placeholder="Mobile number"], input[type=tel]:not([readonly])', PHONE);
  await clickText(d, /^(Log in|Continue|Send OTP)/i, { selector: 'button' });
  await sleep(2000); await otp(d); await sleep(500);
  await clickText(d, /Verify/i, { selector: 'button' }).catch(() => {});
  await sleep(7000);
}
module.exports = { slideAccept, loginRider };

if (require.main === module) (async () => {
  const browser = await launch();
  const d = await newApp(browser, 'rider', { lat: 22.7205, lng: 75.8710 });
  const r = await newApp(browser, 'rest');
  await step(d, '30-login', () => loginRider(d));
  await step(r, '30-login', () => loginRestaurant(r));
  await sleep(4000);
  await log(r, '31-popup');
  const before = await r.evaluate(() => window.__plays.length);
  await step(r, '32-accept', async () => { await slideAccept(r); await sleep(4000); });
  await sleep(6000);
  const after = await r.evaluate(() => window.__plays.length);
  console.log(`\nRING after accept: playsBefore=${before} playsAfter10s=${after} (should stay the same once accepted)`);
  await log(d, '33-rider-home');
  console.log('\nREST LOGS\n' + r.logs.filter((l) => !/Push API/.test(l)).slice(0, 20).join('\n'));
  console.log('\nRIDER LOGS\n' + d.logs.filter((l) => !/Push API/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
