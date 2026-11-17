// node scripts/make-splash-assets.cjs <logo-icon.png> <logo.png> <assetsDir>   (needs `sharp`, e.g. NODE_PATH=../Frontend/node_modules)
// Layers of the animated splash, cut from the web's logos (Frontend/public/logo-icon.webp, logo.webp):
//   splash-f.png      the red "F" badge with its three drops (transparent)
//   splash-word.png   the "Foodie" letters in white + the green leaf, on transparent (for the red background)
//   splash-smile.png  the smile under the word, in white, same canvas as splash-word.png (drawn left -> right)
//   splash-icon-light.png  native splash image: 1024 transparent square with the F badge 46 % wide
const sharp = require('sharp');
sharp.cache(false);
const [iconSrc, logoSrc, assets] = process.argv.slice(2);

(async () => {
  const icon = await sharp(iconSrc).ensureAlpha().trim().png().toBuffer();
  await sharp(icon).toFile(`${assets}/splash-f.png`);
  const iconMeta = await sharp(icon).metadata();
  const size = Math.round(1024 * 0.46);
  const iconSized = await sharp(icon).resize({ width: size, height: Math.round((size * iconMeta.height) / iconMeta.width) }).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: iconSized, gravity: 'center' }])
    .png()
    .toFile(`${assets}/splash-icon-light.png`);

  // word part of the banner: right of the badge
  const meta = await sharp(logoSrc).metadata();
  const left = Math.round(meta.width * 0.355);
  const { data, info } = await sharp(logoSrc)
    .extract({ left, top: 0, width: meta.width - left, height: meta.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const word = Buffer.alloc(W * H * 4);
  const smile = Buffer.alloc(W * H * 4);
  // cream background colour = top-left pixel of the crop
  const bg = [data[0], data[1], data[2]];
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    const a = Math.max(0, Math.min(255, Math.round((dist - 18) * 3)));
    if (!a) continue;
    const y = Math.floor(i / W);
    const isRed = r > 150 && g < 110 && b < 110;
    const isGreen = g > r + 20 && g > b;
    if (isRed && y > H * 0.62) {
      smile[i * 4] = smile[i * 4 + 1] = smile[i * 4 + 2] = 255;
      smile[i * 4 + 3] = a;
    } else if (isGreen) {
      word[i * 4] = r; word[i * 4 + 1] = g; word[i * 4 + 2] = b; word[i * 4 + 3] = a;
    } else if (!isRed) {
      word[i * 4] = word[i * 4 + 1] = word[i * 4 + 2] = 255;
      word[i * 4 + 3] = a;
    }
  }
  const raw = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });
  // trim both to the word's box so they line up
  const wordPng = await raw(word).png().toBuffer();
  const { info: t } = await sharp(wordPng).trim().toBuffer({ resolveWithObject: true });
  const box = { left: -t.trimOffsetLeft, top: -t.trimOffsetTop, width: t.width, height: Math.min(H + t.trimOffsetTop, Math.round(t.height * 1.45)) };
  box.height = Math.min(box.height, H - box.top);
  await sharp(wordPng).extract(box).toFile(`${assets}/splash-word.png`);
  await raw(smile).extract(box).png().toFile(`${assets}/splash-smile.png`);
  console.log('done', box);
})();
