const { launch, newApp, shot, text, clickText, sleep, BASE } = require('./lib');
const { loginUser, step, log } = require('./t2_order');
(async () => {
  const browser = await launch();
  const u = await newApp(browser, 'user');
  await step(u, '80-login', () => loginUser(u));
  for (const path of ['/user/orders/6ac1bf4438e2a1b2df2793d6', '/food/user/orders/6ac1bf4438e2a1b2df2793d6', '/food/user/orders/FOD-5077886']) {
    await u.goto(BASE + path, { waitUntil: 'networkidle2' }); await sleep(8000);
    await log(u, '81-' + path.replace(/\W+/g, '_'));
  }
  console.log('\nUSER LOGS\n' + u.logs.filter((l) => !/Push API/.test(l)).slice(0, 30).join('\n'));
  await browser.close();
})();
