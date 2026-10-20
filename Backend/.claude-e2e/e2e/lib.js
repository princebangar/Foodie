const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  return puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run', '--use-fake-ui-for-media-stream'],
  });
}

// Each app gets its own incognito context (separate localStorage = separate logins)
async function newApp(browser, name, { lat = 22.7201357, lng = 75.8713688 } = {}) {
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(BASE, ['geolocation', 'notifications']);
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.setGeolocation({ latitude: lat, longitude: lng, accuracy: 20 });
  page.logs = [];
  page.on('console', (m) => { const t = m.text(); if (/error|fail|warn/i.test(m.type() + t)) page.logs.push(`[${m.type()}] ${t}`.slice(0, 300)); });
  page.on('pageerror', (e) => page.logs.push(`[pageerror] ${e.message}`.slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) page.logs.push(`[http ${r.status()}] ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  // count audio plays (ring checks)
  await page.evaluateOnNewDocument(() => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src, t: Date.now() }); return orig.call(this).catch(() => {}); };
  });
  page.appName = name;
  return page;
}

async function shot(page, label) {
  const f = path.join(SHOTS, `${page.appName}-${label}.png`);
  await page.screenshot({ path: f });
  return f;
}

async function text(page) { return page.evaluate(() => document.body.innerText); }

async function clickText(page, re, { selector = 'button, a, [role=button], div, span, p', timeout = 8000 } = {}) {
  const rx = re instanceof RegExp ? re.source : re;
  const flags = re instanceof RegExp ? re.flags : 'i';
  const ok = await page.waitForFunction((sel, rx, flags) => {
    const r = new RegExp(rx, flags);
    const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && r.test((e.innerText || '').trim()));
    // deepest match
    const el = els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, { timeout }, selector, rx, flags).catch(() => null);
  if (!ok) throw new Error(`clickText not found: ${re}`);
  const pt = await ok.jsonValue();
  await sleep(250);
  await page.mouse.click(pt.x, pt.y);
  await sleep(400);
}

async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value, { delay: 20 });
}

async function otp(page, code = '1234') {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.type(code[i], { delay: 60 });
  }
}

// Drag a framer-motion slider whose label matches `re` from its handle to the right end.
async function dragSlider(page, re) {
  const box = await page.evaluate((rx, flags) => {
    const r = new RegExp(rx, flags);
    const label = [...document.querySelectorAll('span, p, div')].filter((e) => e.offsetParent && r.test((e.innerText || '').trim()))
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!label) return null;
    let track = label;
    while (track && !(track.getBoundingClientRect().width > 220 && track.querySelector('[style*="touch-action"], [draggable], button'))) track = track.parentElement;
    if (!track) return null;
    const handle = track.querySelector('[style*="touch-action"]') || track.querySelector('button');
    track.scrollIntoView({ block: 'center' });
    const t = track.getBoundingClientRect(); const h = handle.getBoundingClientRect();
    return { hx: h.left + h.width / 2, hy: h.top + h.height / 2, tx: t.right - 6 };
  }, re.source, re.flags);
  if (!box) throw new Error(`slider not found: ${re}`);
  await page.mouse.move(box.hx, box.hy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(box.hx + ((box.tx - box.hx) * i) / 20, box.hy, { steps: 2 }); await sleep(25); }
  await page.mouse.up();
  await sleep(500);
}

module.exports = { dragSlider, launch, newApp, shot, text, clickText, typeInto, otp, sleep, BASE };
