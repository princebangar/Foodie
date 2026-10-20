const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { loginUser, step, log } = require('./t2_order');
(async () => {
  const browser = await launch();
  const u = await newApp(browser, 'user');
  await step(u, '90-login', () => loginUser(u));
  await u.goto(`${BASE}/food/user/restaurants/the-prince-restro`, { waitUntil: 'networkidle2' }); await sleep(2500);
  await clickText(u, /^ADD\s*\+?$/, { selector: 'button' }); await sleep(1500);
  await step(u, '91-cart', async () => { await u.goto(`${BASE}/food/user/cart`, { waitUntil: 'networkidle2' }); await sleep(3500); });
  // the add-on card "+" button sits next to its name
  await step(u, '92-addon', async () => {
    const pt = await u.evaluate(() => {
      const name = [...document.querySelectorAll('p')].find((p) => /E2E Extra Masala/.test(p.innerText));
      if (!name) return null;
      const btn = name.parentElement.querySelector('button');
      btn.scrollIntoView({ block: 'center' });
      const b = btn.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    if (!pt) throw new Error('addon card not found');
    await u.mouse.click(pt.x, pt.y); await sleep(3000);
  });
  const t = await text(u);
  console.log('ADDON IN CART LINES?', /E2E Extra Masala[\s\S]{0,40}₹?20/.test(t), '| bill:', (t.match(/Bill Details\s*\n?\s*₹[\d.]+/) || [])[0]);
  await step(u, '93-place', async () => { await clickText(u, /Place Order/, { selector: 'button' }); await sleep(6000); });
  console.log('\nUSER LOGS\n' + u.logs.filter((l) => !/Push API/.test(l)).slice(0, 20).join('\n'));
  await browser.close();
})();
