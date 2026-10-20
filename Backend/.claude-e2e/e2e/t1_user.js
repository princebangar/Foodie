const { launch, newApp, shot, text, clickText, typeInto, otp, sleep, BASE } = require('./lib');
const step = async (u, label, fn) => {
  try { await fn(); } catch (e) { console.log(`!! ${label}: ${e.message}`); }
  await sleep(1500);
  await shot(u, label);
  console.log(`\n=== ${label} @ ${u.url().replace(BASE, '')}\n` + (await text(u)).replace(/\n+/g, ' | ').slice(0, 600));
};
(async () => {
  const browser = await launch();
  const u = await newApp(browser, 'user');
  await u.goto(`${BASE}/user/auth/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await step(u, '01-phone', async () => {
    await typeInto(u, 'input[placeholder="Mobile number"]', '8962843670');
    await clickText(u, /^Log in$/, { selector: 'button' });
  });
  await step(u, '02-otp', async () => { await sleep(1000); await otp(u); await sleep(500); await clickText(u, /Verify & Continue/, { selector: 'button' }).catch(() => {}); await sleep(5000); });
  await step(u, '03-home', async () => { await sleep(4000); });
  await step(u, '04-restaurant', async () => { await clickText(u, /The Prince Restro/, { timeout: 15000 }); await sleep(3000); });
  console.log('\nLOGS\n' + u.logs.slice(0, 40).join('\n'));
  await browser.close();
})();
