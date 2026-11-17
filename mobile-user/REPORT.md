# Foodie User app — native report (16 Nov 2026)

## Kya hua
- Web ka customer app (`/food/user/*` + `/user/auth/*`) Expo / React Native me convert: `mobile-user/`.
- Package `com.foodie.user`, naam "Foodie", version 1.0.0 (versionCode 1). Firebase: `Downloads/Foodie App/google-services-user.json`.
- Icon: web ka `Frontend/public/logo-icon.webp` (red "F"), splash: Foodie red + white "Foodie" lettering (`logo.webp` se), phir animated scene
  (`src/native/AnimatedSplash.jsx`: naam bada hota hai, smile draw hoti hai, food icons pop/float, "ORDER · EAT · REPEAT"). `scripts/make-app-icons.cjs`.
- Keystore: `C:/Users/Prince/.foodie/foodie-user-upload.jks` (password `USER_KEYSTORE_README.txt` me), Gradle props `FOODIE_USER_*`.
  SHA-1 `B3:37:2B:75:BE:67:FA:B8:B8:F4:2C:2E:A9:72:F6:61:92:5A:05:DD` — Google Maps / Firebase console me add karna.
- Backend same: `https://foodie.org.in/api/v1` (`.env`).

## Kaise convert kiya
- Base: Foodie ke apne `mobile-delivery` ka shell (native/ui, lib, theme, scripts).
- Hello_Parth se sirf wo Food-user files li jinka web code Foodie jaisa hi tha. Jo files alag thi, unme Foodie web ka
  diff 3-way merge se laga (`HP web -> Foodie web` changes native file pe), aur conflicts haath se native me likhe.
- Foodie-only cheezein fresh likhi: Login (image slider + OTP page + name / restore popups), LoginImageSlider, OTP page,
  Diamond (page, terms, support chat), DiamondBrand, Profile, StickyCartCard + fly-to-cart animation, AddToCartAnimation,
  BogoTag, BogoAppliedPopup, ComboOffersRow, LocationPrompt, DeliverySafety, OutOfZone (Taxi hata ke).
- Taxi / Global / My Store / merged wallet ka koi code nahi. Restaurant, delivery, web, backend: koi file nahi badli.

## Checks
- `check-converted`: 336 files, 1 "problem" (EditProfile me DateTimePicker ka `onChange` — uska sahi native API hai).
- ESLint (no-undef ke saath): 0 errors. Android JS bundle (`expo export`): ban gaya.
- 70 route files (`scripts/gen-routes.cjs`, web ke UserRouter table se).

## Web jaisa nahi / dhyan dena
- Lexend font (login / Diamond support) app me bundled nahi: default font dikhta hai.
- Gradient text (Diamond "DIAM ND", "Diamond Member") SVG se bana hai; sentence ke beech "Diamond" sirf ice-blue colour me.
- Web ka status-bar colour handler (meta theme-color) nahi: har screen apna status bar set karti hai.

## Phone pe check karna (Built, not tested)
1. Install `releases/Foodie-User-1.0.0.apk` (purana web-wrapper "Foodie" app ho to pehle uninstall).
2. Splash -> Login: images slide, Skip -> Home (guest); number daalo -> OTP page -> naya user ho to name popup.
3. Location prompt: Allow / manual address; Home: header, Flavour Fest banner, Combo Offers, Recommended, explore icons.
4. Restaurant: ADD (fly-to-cart), variant dish ka popup, Combo Offers chip, BOGO dish -> "Buy 1 Get 1 applied" popup.
5. Cart: BOGO free line, Diamond strip / bill rows, coupon, address chips, Razorpay / COD / wallet se order.
6. Order tracking (map), Orders list, order details, invoice, complaint.
7. Profile: Diamond card, wallet, Veg mode, Appearance (dark mode), Edit profile (mobile, DOB, anniversary, photo), logout.
8. Diamond page: join (Razorpay), terms, support chat. Dining, Under 250, search + voice search, notifications.
9. Back button har jagah, login screen pe Back -> app band, no-internet notice.
