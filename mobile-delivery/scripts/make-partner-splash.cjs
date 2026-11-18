// NODE_PATH=../Frontend/node_modules node scripts/make-partner-splash.cjs .   (from the app folder)
// Native splash with the "DELIVERY / RESTAURANT PARTNER" label under the Foodie wordmark, taken from the app icon
// (assets/icon.png) so font and colours are exactly the icon's. Writes:
//   assets/splash-partner-label.png   the label alone on transparent (for the animated splash's first frame)
//   assets/splash-icon-light.png      1024 canvas: wordmark + label, block centred (app.json splash image)
//   android/.../drawable-*/splashscreen_logo.png   same, at every density (288 dp box, 240 dp canvas inside)
// and prints the layout numbers the animated splash needs.
const path = require('path');
const sharp = require('sharp'); // not a dependency: run with NODE_PATH=<a folder with sharp>/node_modules (e.g. Frontend)
const fs = require('fs');

const app = path.resolve(process.argv[2]);
const A = (f) => path.join(app, 'assets', f);

async function raw(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

(async () => {
  // ---- 1. find the wordmark and the two label lines in the icon (rows whose pixels differ from the background)
  const icon = await raw(A('icon.png'));
  const px = (x, y) => {
    const i = (y * icon.w + x) * 4;
    return [icon.data[i], icon.data[i + 1], icon.data[i + 2]];
  };
  const bgAt = (x, y) => {
    // the background is a smooth gradient: interpolate between the row's left and right edges
    const avg = (x0, x1) => {
      const s = [0, 0, 0];
      for (let xx = x0; xx < x1; xx++) px(xx, y).forEach((v, k) => (s[k] += v));
      return s.map((v) => v / (x1 - x0));
    };
    const L = avg(20, 90);
    const R = avg(icon.w - 90, icon.w - 20);
    const t = (x - 55) / (icon.w - 110);
    return L.map((v, k) => v + (R[k] - v) * t);
  };
  const diff = (x, y) => {
    const p = px(x, y), b = bgAt(x, y);
    return Math.abs(p[0] - b[0]) + Math.abs(p[1] - b[1]) + Math.abs(p[2] - b[2]);
  };
  const rowHas = [];
  for (let y = 0; y < icon.h; y++) {
    let n = 0;
    for (let x = 100; x < icon.w - 100; x += 2) if (diff(x, y) > 90) n++;
    rowHas.push(n > 2);
  }
  const runs = [];
  for (let y = 0; y < icon.h; y++) {
    if (rowHas[y] && (y === 0 || !rowHas[y - 1])) runs.push([y, y]);
    if (rowHas[y]) runs[runs.length - 1][1] = y;
  }
  // merge runs closer than 12 px (the smile under the wordmark, dots)
  const blocks = [];
  for (const r of runs) {
    const last = blocks[blocks.length - 1];
    if (last && r[0] - last[1] < 12) last[1] = r[1];
    else blocks.push([...r]);
  }
  const big = blocks.filter((b) => b[1] - b[0] > 20);
  if (big.length < 3) throw new Error(`expected wordmark + 2 label lines, got ${JSON.stringify(big)}`);
  const [wm, line1, line2] = big.slice(-3);
  const colsOf = ([y0, y1]) => {
    let x0 = icon.w, x1 = 0;
    for (let y = y0; y <= y1; y++) for (let x = 60; x < icon.w - 60; x++) if (diff(x, y) > 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return [x0, x1];
  };
  const wmX = colsOf(wm), l1X = colsOf(line1), l2X = colsOf(line2);
  console.log('icon wordmark', wm, wmX, 'line1', line1, l1X, 'line2', line2, l2X);

  // ---- 2. the label on transparent: un-blend each line from the background with its known text colour
  const pad = 6;
  const lx0 = Math.min(l1X[0], l2X[0]) - pad, lx1 = Math.max(l1X[1], l2X[1]) + pad;
  const ly0 = line1[0] - pad, ly1 = line2[1] + pad;
  const LW = lx1 - lx0 + 1, LH = ly1 - ly0 + 1;
  // text colours: the most saturated pixel of line 1 (yellow), white for line 2
  let yellow = [255, 200, 40], best = -1;
  for (let y = line1[0]; y <= line1[1]; y++) for (let x = l1X[0]; x <= l1X[1]; x++) {
    const p = px(x, y);
    const sat = p[0] + p[1] - 2 * p[2];
    if (sat > best) { best = sat; yellow = p; }
  }
  // the most common text colour of line 1 (the fill), not the most saturated pixel (an anti-aliased edge)
  {
    const cnt = new Map();
    for (let y = line1[0]; y <= line1[1]; y++) for (let x = l1X[0]; x <= l1X[1]; x++) {
      if (diff(x, y) < 200) continue;
      const k = px(x, y).map((v) => v >> 1 << 1).join(',');
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    yellow = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
    console.log('line 1 colour', yellow);
  }
  const white = [255, 255, 255];
  const mid = Math.round((line1[1] + line2[0]) / 2);
  // background under the label: per column, between text-free rows just above line 1 and just below line 2
  // (the restaurant icon's gradient is radial, a row-wise estimate left a streak)
  const rowAvg = (x, yc) => {
    const s = [0, 0, 0];
    for (let yy = yc - 1; yy <= yc + 1; yy++) px(x, yy).forEach((v, k) => (s[k] += v / 3));
    return s;
  };
  const yA = line1[0] - 10, yB = line2[1] + 10;
  const labelBg = (x, y) => {
    const a = rowAvg(x, yA), b = rowAvg(x, yB);
    const t = (y - yA) / (yB - yA);
    return a.map((v, k) => v + (b[k] - v) * t);
  };
  const out = Buffer.alloc(LW * LH * 4);
  for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) {
    const C = y <= mid ? yellow : white;
    const P = px(x, y), B = labelBg(x, y);
    const CB = C.map((v, k) => v - B[k]);
    const PB = P.map((v, k) => v - B[k]);
    let a = (PB[0] * CB[0] + PB[1] * CB[1] + PB[2] * CB[2]) / (CB[0] ** 2 + CB[1] ** 2 + CB[2] ** 2);
    a = Math.max(0, Math.min(1, a));
    if (a < 0.04) a = 0;
    const o = ((y - ly0) * LW + (x - lx0)) * 4;
    out[o] = C[0]; out[o + 1] = C[1]; out[o + 2] = C[2]; out[o + 3] = Math.round(a * 255);
  }
  const label = await sharp(out, { raw: { width: LW, height: LH, channels: 4 } }).png().toBuffer();
  // stored at 2x the icon's size so it stays sharp on the animated splash
  await sharp(label).resize({ width: LW * 2, kernel: 'lanczos3' }).png().toFile(A('splash-partner-label.png'));

  // ---- 3. the 1024 splash canvas: wordmark + label at the icon's proportions, block scaled to fit Android 12's
  // 192 dp circle (canvas 240 dp: radius 96 dp = 410 px; keep every corner within R_MAX)
  const R_MAX = 372;
  const wmW = wmX[1] - wmX[0] + 1;
  const blockTop = wm[0], blockBottom = ly1;
  const corners = (s) => {
    const cy = (blockTop + blockBottom) / 2, cx = icon.w / 2;
    const pts = [
      [wmX[0], wm[0]], [wmX[1], wm[0]], [wmX[0], wm[1]], [wmX[1], wm[1]],
      [l1X[0], line1[1]], [l1X[1], line1[1]], [l2X[0], line2[1]], [l2X[1], line2[1]],
    ];
    return Math.max(...pts.map(([x, y]) => Math.hypot((x - cx) * s, (y - cy) * s)));
  };
  let s = 1.2;
  while (corners(s) > R_MAX) s -= 0.005;
  const C = 1024;
  const blockH = (blockBottom - blockTop) * s;
  const top = (C - blockH) / 2;
  const wordmarkPng = await sharp(A('splash-wordmark-light.png')).trim().toBuffer({ resolveWithObject: true });
  const W = Math.round(wmW * s);
  const wmImg = await sharp(wordmarkPng.data).resize({ width: W }).png().toBuffer({ resolveWithObject: true });
  const wmTop = Math.round(top);
  const lblW = Math.round(LW * s);
  const lblImg = await sharp(label).resize({ width: lblW }).png().toBuffer({ resolveWithObject: true });
  const lblTop = Math.round(top + (ly0 - blockTop) * s);
  const canvas = await sharp({ create: { width: C, height: C, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: wmImg.data, left: Math.round((C - W) / 2), top: wmTop },
      { input: lblImg.data, left: Math.round((C - lblW) / 2), top: lblTop },
    ])
    .png()
    .toBuffer();
  await sharp(canvas).toFile(A('splash-icon-light.png'));

  // ---- 4. android drawables: 288 dp box with the 240 dp canvas centred (as expo prebuild made them)
  const res = path.join(app, 'android/app/src/main/res');
  for (const dir of fs.readdirSync(res).filter((d) => d.startsWith('drawable'))) {
    const f = path.join(res, dir, 'splashscreen_logo.png');
    if (!fs.existsSync(f)) continue;
    const { width: box } = await sharp(f).metadata();
    const inner = Math.round((box * 240) / 288);
    const scaled = await sharp(canvas).resize({ width: inner, kernel: 'lanczos3' }).png().toBuffer();
    const off = Math.round((box - inner) / 2);
    await sharp({ create: { width: box, height: box, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left: off, top: off }]).png().toFile(f);
  }

  // ---- 5. numbers for AnimatedSplash (dp; canvas 1024 px = 240 dp, centred on the window)
  const dp = (v) => +((v * 240) / C).toFixed(2);
  const wmH = wmImg.info.height;
  console.log(JSON.stringify({
    scale: +s.toFixed(3),
    NATIVE_WORDMARK_W: dp(W),
    NATIVE_WORDMARK_CENTER_Y: dp(wmTop + wmH / 2 - C / 2), // offset from the window centre
    NATIVE_LABEL_W: dp(lblW),
    NATIVE_LABEL_CENTER_Y: dp(lblTop + lblImg.info.height / 2 - C / 2),
    LABEL_RATIO: +(lblImg.info.height / lblW).toFixed(4),
  }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
