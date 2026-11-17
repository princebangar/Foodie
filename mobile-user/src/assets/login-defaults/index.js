// The login banners built into the app (the same ones uploaded in admin > Login Pages): shown on a fresh install until
// the admin images have downloaded, and whenever the admin list is empty.
const DEFAULT_LOGIN_SLIDES = [
  require('./banner-1.webp'),
  require('./banner-2.webp'),
  require('./banner-3.webp'),
  require('./banner-4.webp'),
].map((source, i) => ({ _id: `default-${i + 1}`, source }));

export default DEFAULT_LOGIN_SLIDES;
