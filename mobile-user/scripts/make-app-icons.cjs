// node scripts/make-app-icons.cjs <logo-icon.png> <wordmark.png> <assetsDir>   (needs `sharp`, e.g. NODE_PATH=../Frontend/node_modules)
// Foodie user app icons from the web's square "F" icon (Frontend/public/logo-icon.webp, transparent) and the
// wordmark banner (Frontend/public/logo.webp):
//   icon.png                     1024 white square, F icon 760 px
//   android-icon-foreground.png  1024 transparent, F icon 600 px (adaptive icon safe zone; background #ffffff)
//   android-icon-monochrome.png  white silhouette of the F badge (themed icons)
//   notification-icon.png        96 px white "F" letter (the white part of the badge) on transparent
//   splash-icon-light.png        1024 transparent square with the wordmark 86 % wide (native splash, white background)
//   splash-wordmark.png          the wordmark trimmed (JS splash)
const sharp = require('sharp');
const [iconSrc, wordSrc, assets] = process.argv.slice(2);

const box = (size, bg) => sharp({ create: { width: size, height: size, channels: 4, background: bg } });
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

(async () => {
  const icon = await sharp(iconSrc).ensureAlpha().trim().toBuffer();

  await box(1024, WHITE).composite([{ input: await sharp(icon).resize({ width: 760, height: 760, fit: 'contain', background: CLEAR }).toBuffer(), gravity: 'center' }]).png().toFile(`${assets}/icon.png`);
  await box(1024, CLEAR).composite([{ input: await sharp(icon).resize({ width: 600, height: 600, fit: 'contain', background: CLEAR }).toBuffer(), gravity: 'center' }]).png().toFile(`${assets}/android-icon-foreground.png`);

  // silhouettes: whole badge (monochrome) / only the white F inside it (notification)
  const silhouette = async (size, onlyWhite) => {
    const { data, info } = await sharp(icon).resize({ width: size, height: size, fit: 'contain', background: CLEAR }).raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      const whiteness = Math.min(r, g, b);
      const alpha = onlyWhite ? (a > 128 ? Math.max(0, Math.min(255, (whiteness - 150) * 2.5)) : 0) : a;
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
      out[i * 4 + 3] = alpha;
    }
    return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  };
  await box(1024, CLEAR).composite([{ input: await silhouette(600, false), gravity: 'center' }]).png().toFile(`${assets}/android-icon-monochrome.png`);
  await box(96, CLEAR).composite([{ input: await silhouette(96, true), gravity: 'center' }]).png().toFile(`${assets}/notification-icon.png`);

  // wordmark: flatten the cream background to white, trim
  const word = await sharp(wordSrc).flatten({ background: '#ffffff' }).trim({ threshold: 25 }).png().toBuffer();
  await sharp(word).toFile(`${assets}/splash-wordmark.png`);
  await box(1024, CLEAR).composite([{ input: await sharp(word).resize({ width: 880 }).toBuffer(), gravity: 'center' }]).png().toFile(`${assets}/splash-icon-light.png`);
  console.log('done');
})();
