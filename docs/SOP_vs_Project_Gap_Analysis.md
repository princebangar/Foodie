# SOP vs Foodie Project — Gap Analysis

**SOP:** `Food delivery application Documentation.pdf` (Master Blueprint + Part 1 Architecture + Part 2 Screen Spec)
**Project:** `Foodie/` (Backend + Frontend), branch `main`, analysed on 2026-10-27
**Scope:** Read-only comparison. No code was changed.

### Status legend

| Mark | Meaning |
|---|---|
| ✅ | Present and broadly matches the SOP |
| 🟡 | Partially present / implemented differently |
| 🎨 | UI page exists in Frontend but has **no backend / no API calls** (mock screen) |
| ❌ | Missing |
| ➕ | Exists in project but **not asked for** in SOP (or SOP puts it in a later version) |

---

## 1. Executive summary

The project already covers most of the SOP's **MVP (Section 118)** and a good part of **Version 2**: OTP login for all 3 apps, restaurant/rider onboarding with KYC + admin approval, menu with variants and add-ons, server-side cart, coupons, Razorpay + COD + wallet, auto-dispatch, live tracking, drop-OTP delivery, rider earnings/incentives/cash-limit, wallets & withdrawals, referrals, zones, fee settings, commission, support tickets, sub-admin permissions, and even **Dining** (which the SOP puts in Version 3).

The biggest differences are:

1. **Tech stack** — SOP recommends Flutter + NestJS/TypeScript + PostgreSQL + OpenSearch + Kafka/RabbitMQ. Project is **React PWA + Express (JavaScript) + MongoDB + Redis/BullMQ + Socket.IO/Firebase**.
2. **Order state machine** — SOP has ~20 explicit states with strict transitions; project has 11 order states plus separate payment/dispatch/delivery sub-states, enforced by "forward-only" priority, and admin can force any status.
3. **Missing growth/scale modules** — Membership, Gift Cards, Advertising, Loyalty, Fraud/Risk, Audit Log, Reconciliation, Settlement batches, Feature Flags, Multi-language, Restaurant branches/staff, KDS, Admin MFA.
4. **Several admin pages are UI-only mocks** — Advertisement, Campaigns, Loyalty Point, Employees (no API calls).
5. **No automated tests** — `npm test` is a placeholder; only ad-hoc scripts in `Backend/.claude-e2e/`.

---

## 2. Platform / application layout

| SOP application (Sec 1) | Project | Status |
|---|---|---|
| Customer Mobile App (Android/iOS) | No native app. Customer UI is part of the React web app (`Frontend/src/modules/Food/pages/user`), installable as **PWA** (`vite-plugin-pwa`) | 🟡 |
| Customer Web App | Same React app | ✅ |
| Restaurant Partner App + Web Dashboard | `Food/pages/restaurant` (web/PWA) | 🟡 (no native) |
| Delivery Partner App | `modules/DeliveryV2` (web/PWA) | 🟡 (no native, background GPS limited in browser) |
| Admin Web Portal | `Food/pages/admin` | ✅ |
| Super Admin Portal | Same admin portal, `ADMIN` role vs `SUB_ADMIN` | 🟡 |
| Operations / Command Center (live map) | No live ops map; orders list + "Order Detect Delivery" page | 🟡 |
| Customer Support Portal | Support tickets inside admin (user, restaurant, delivery) | 🟡 |
| Finance & Settlement Portal | Withdrawals, wallets, cash-limit settlement, reports inside admin | 🟡 |
| Marketing / Advertising Portal | Advertisement & Campaign pages are mock UI | 🎨 |
| Restaurant / Delivery Onboarding Portals | Built into restaurant & delivery registration flows + admin join-requests | ✅ |
| Kitchen Display System (KDS) | — | ❌ |
| All apps share one domain/codebase | Single Vite app with role routing (`modules/auth/pages/Portal.jsx`) | ➕ design choice |

---

## 3. Technology stack

| Layer | SOP recommendation (Sec 73–76, Part 1 §16) | Project | Status |
|---|---|---|---|
| Mobile | Flutter / React Native / native | None — React PWA | ❌ / 🟡 |
| Web / Admin | React / Next.js + TypeScript | React 19 + Vite 7, **JavaScript (JSX)**, Tailwind 4, MUI, Radix, Redux Toolkit + Zustand | 🟡 (no TS, no Next.js) |
| Backend | Node.js **NestJS + TypeScript** | Node.js **Express 4, plain JS (ESM)** | 🟡 |
| Architecture | Modular monolith first | Modular monolith (`src/core`, `src/modules/food/*`) | ✅ |
| Primary DB | **PostgreSQL** (+ PostGIS) | **MongoDB / Mongoose** with `2dsphere` geo indexes | 🟡 different |
| Cache | Redis | Redis (ioredis + redis), cache middleware | ✅ |
| Search | OpenSearch / Elasticsearch | MongoDB `$regex` search (`search.service.js`) | 🟡 |
| Message queue | Kafka / RabbitMQ / SQS | **BullMQ on Redis** (otp, notification, order, tracking, payment workers) | 🟡 acceptable for MVP |
| Real-time | WebSockets | Socket.IO + Redis adapter + Firebase Realtime DB (`active_orders/*`) | ✅ |
| Object storage | S3-compatible | Cloudinary + local storage (`storage.service.js`, migration script) | 🟡 |
| Payments | Razorpay / Cashfree / PayU, modular | Razorpay only (orders, QR, webhook) | 🟡 single provider |
| Maps | Google Maps / Mappls | Google Maps (`@react-google-maps/api`, `googleMaps.js`) + Leaflet | ✅ |
| Push | FCM + APNs | FCM (`firebase-admin`) | ✅ (no APNs, no native) |
| SMS | Transactional SMS provider | SMS India Hub (OTP only) | ✅ |
| Email | SES or equivalent | Nodemailer (`utils/email.js`, used for admin flows) | 🟡 |
| Analytics warehouse | ClickHouse / BigQuery etc. | — | ❌ |
| Monitoring | OpenTelemetry / Prometheus / Grafana | Logger, request-id, response-time logger, `/v1/health` | 🟡 |
| Deploy | Docker / K8s, CI/CD | PM2 `ecosystem.config.cjs`; no Docker, no CI | ❌ |
| Environments | Dev / QA / Staging / Prod | Not defined in repo | ❌ |

---

## 4. Roles & access control (Sec 82, Part 1 §7.12, Part 2 ADM-031/032)

| SOP role | Project equivalent | Status |
|---|---|---|
| SUPER_ADMIN | `ADMIN` | ✅ |
| ADMIN / OPERATIONS / FINANCE / SUPPORT / MARKETING / CITY ADMIN | `SUB_ADMIN` with per-module `view/create/edit/delete` permissions (~60 modules in `subAdminPermissions.js`) | 🟡 (no named roles, no city scoping) |
| RESTAURANT_ADMIN / MANAGER / STAFF | Single `RESTAURANT` login per restaurant | ❌ staff roles |
| DELIVERY_PARTNER | `DELIVERY_PARTNER` | ✅ |
| CUSTOMER | `USER` | ✅ |
| Granular permission IDs (`orders.cancel`, `refunds.approve`…) | Module-level permissions only | 🟡 |
| Backend enforcement of every permission | `requireRoles` + `subAdminPermission.middleware.js` | ✅ (verify coverage per route) |

> Note: `Backend/src/constants/roles.js`, `permissions.js` and `orderStatus.js` are **empty files** — roles and statuses are hard-coded as strings across models/services.

---

## 5. Order status engine (Sec 20, Part 1 §8.6)

### SOP states (20)
`CREATED, PAYMENT_PENDING, PAYMENT_SUCCESS, PAYMENT_FAILED, RESTAURANT_PENDING, RESTAURANT_ACCEPTED, RESTAURANT_REJECTED, PREPARING, READY_FOR_PICKUP, DELIVERY_ASSIGNMENT_PENDING, DELIVERY_ASSIGNED, RIDER_REACHED_RESTAURANT, PICKED_UP, OUT_FOR_DELIVERY, RIDER_REACHED_CUSTOMER, DELIVERED, CANCELLED, REFUND_PENDING, REFUNDED, FAILED`

### Project (`order.model.js`)
| Field | Values |
|---|---|
| `orderStatus` | `created, confirmed, preparing, ready_for_pickup, reached_pickup, picked_up, reached_drop, delivered, cancelled_by_user, cancelled_by_restaurant, cancelled_by_admin` |
| `payment.status` | `cod_pending, created, authorized, paid, failed, refunded, pending_qr` |
| `payment.refund.status` | `none, pending, processed, failed` |
| `dispatch.status` | `unassigned, assigned, accepted, rejected, cancelled` |
| `deliveryState.currentPhase` | `en_route_to_pickup, at_pickup, en_route_to_delivery, at_drop, delivered, completed` |

### Mapping

| SOP | Project | Status |
|---|---|---|
| CREATED / RESTAURANT_PENDING | `created` | ✅ |
| PAYMENT_* | `payment.status` (separate field) | 🟡 split |
| RESTAURANT_ACCEPTED | `confirmed` | ✅ |
| RESTAURANT_REJECTED | `cancelled_by_restaurant` (no distinct "rejected") | 🟡 |
| PREPARING / READY_FOR_PICKUP | `preparing` / `ready_for_pickup` | ✅ |
| DELIVERY_ASSIGNMENT_PENDING / ASSIGNED | `dispatch.status` | 🟡 split |
| RIDER_REACHED_RESTAURANT | `reached_pickup` | ✅ |
| PICKED_UP / OUT_FOR_DELIVERY | `picked_up` (no separate out-for-delivery) | 🟡 |
| RIDER_REACHED_CUSTOMER | `reached_drop` | ✅ |
| DELIVERED | `delivered` | ✅ |
| REFUND_PENDING / REFUNDED | `payment.refund.status` / `payment.status=refunded` | 🟡 split |
| FAILED / DELIVERY_FAILED | — | ❌ |

| Rule | Project | Status |
|---|---|---|
| "Never allow arbitrary status changes" | Restaurant/rider use `isStatusAdvance` (forward-only by priority, not an explicit transition table). **Admin `PATCH /orders/:id/statuses` can set any allowed status** | 🟡 |
| Status history with actor, from/to, reason | `statusHistory[]` {at, byRole, byId, from, to, note} | ✅ |
| Order item & price snapshot | Items + pricing stored on order (incl. base price, markup, pricing rule) | ✅ |
| Order types | `delivery`, `takeaway`, `dining` | ➕ takeaway/dining extra |

---

## 6. Customer app (Sec 5–55, Part 2 CUS-001…036)

| Feature | Project | Status |
|---|---|---|
| Splash / maintenance check | Maintenance mode middleware + public settings endpoints | ✅ |
| App version / force update | — | ❌ |
| Onboarding slides | Not found | ❌ |
| Login: mobile OTP | `/auth/user/request-otp`, `/verify-otp`, rate-limited | ✅ |
| Login: Email / Google / Apple / Password | — | ❌ |
| Guest browsing | Public restaurant/menu/landing endpoints exist | 🟡 (verify FE gating) |
| Refresh tokens, logout, logout-all-devices | ✅ | ✅ |
| Account deletion (with balance check) | `/auth/delete-account`, archived accounts in admin | ✅ |
| Location: GPS / search / map pin | Google Maps + `useLocation` | ✅ |
| Saved addresses Home/Office/Other + default | `/user/addresses` CRUD | ✅ (SOP also lists "Work") |
| Serviceability check (zone) | Zone polygons, `zoneGeo.js` | ✅ |
| Home: banners, categories, collections, offers, top/gourmet, under-250, explore icons | Landing module, all admin-configurable | ✅ |
| Personalised home / recently ordered | — | ❌ |
| Search restaurants + dishes | `$regex` on name/cuisine | 🟡 (no typo tolerance, ranking, recent/popular searches backend) |
| Filters / sort | Partial in FE | 🟡 |
| Veg Mode | Frontend toggle only (not persisted on backend) | 🟡 |
| Dietary filters (vegan, Jain, gluten-free…), allergens | — | ❌ |
| Restaurant detail page + menu tabs | ✅ | ✅ |
| Variants + add-ons | Variants on foods, restaurant add-ons (with admin approval) | ✅ |
| Add-on groups with min/max selection | Not verified as groups | 🟡 |
| Combos | — | ❌ |
| Server-side cart + coupon on cart | `/food/cart` | ✅ |
| Server-side price recalculation | `/orders/calculate`, `order-pricing.service.js` | ✅ |
| Delivery / cooking instructions, cutlery | `note`, `restaurantNote`, `sendCutlery`, `/orders/:id/instructions` | ✅ |
| Scheduled orders | `scheduledAt` stored & filterable in admin; **no job that releases scheduled orders to the restaurant at the right time** found | 🟡 |
| Tip for rider | — | ❌ |
| Payment: UPI/cards/netbanking | Via Razorpay checkout | ✅ |
| COD (per-customer COD toggle) | ✅ (`/customers/:id/cod-status`) | ✅ ➕ |
| Platform wallet | Wallet + top-up via Razorpay | ✅ |
| Gift cards | — | ❌ |
| Payment idempotency | Online-payment order creation is idempotent (Razorpay order id, pending-online-payment reconcile) | 🟡 (no generic idempotency key header) |
| Live tracking | Socket.IO `location-update` + Firebase RTDB + Redis hot store | ✅ |
| Drop OTP shown to customer | `/orders/:id/drop-otp` | ✅ |
| Cancel order | Allowed only in `created` / `confirmed` | ✅ |
| Order history, details, reorder, invoice | `Orders.jsx`, `UserOrderDetails.jsx`, `OrderInvoice.jsx` | ✅ |
| Rate restaurant & rider (1–5 + comment) | `/orders/:id/ratings` | ✅ |
| Rate individual food items, review photos/video | — | ❌ |
| Favorites | **localStorage only** (`ProfileContext.jsx`) — not synced to backend | 🟡 |
| Referral | Referral settings, logs, stats | ✅ |
| Referral anti-fraud (device/IP/payment) | — | ❌ |
| Membership (Gold-like) | — | ❌ |
| Loyalty points | Admin report page is mock | 🎨 / ❌ |
| Notifications inbox | `/food/notifications` | ✅ |
| Support tickets | `/user/support/ticket` | ✅ |
| Support chat | — | ❌ |
| Safety emergency report | ✅ | ✅ ➕ |
| Dining / table booking | Full module (categories, bookings, requests, banners) | ➕ (SOP = V3) |
| Multi-language | — | ❌ |
| Deep links (`app://order/{id}`) | — | ❌ |

---

## 7. Restaurant partner app (Sec 21–31, Part 1 §5, Part 2 RES-001…026)

| Feature | Project | Status |
|---|---|---|
| OTP login | ✅ | ✅ |
| Password login / forgot password | — (OTP only) | 🟡 |
| Registration + onboarding steps | `/restaurant/register`, `Onboarding.jsx` | ✅ |
| KYC docs: PAN, GST, FSSAI (+expiry check), bank | Restaurant model + `fssaiExpiry.service.js` | ✅ |
| Approval status: pending / approved / rejected / banned + reapply | ✅ | ✅ |
| "More info required" status | — | ❌ |
| Dashboard (today's orders, sales…) | ✅ (verify KPIs) | 🟡 |
| Online / offline toggle | `/restaurant/availability` | ✅ |
| Busy mode / temporary pause | Not as separate modes | 🟡 |
| Weekly operating hours | `outletTimings` per day | ✅ |
| Holiday calendar / special closures | — | ❌ |
| Multi-branch management | — (one restaurant = one outlet) | ❌ |
| Staff accounts & roles | — | ❌ |
| Menu categories, items, images | ✅ | ✅ |
| Variants, add-ons | ✅ (add-ons go through admin approval) | ✅ |
| Food approval by admin before going live | ✅ | ➕ |
| Combos, menu versioning, draft/publish | — | ❌ |
| Bulk menu upload | — | ❌ |
| Mark sold out / back-in-stock timer | `Inventory.jsx` (timer rules kept in **localStorage**) | 🟡 |
| Ingredient-level inventory, auto-unavailable | — | ❌ |
| Incoming order alert, accept/reject, prep time | ✅ + resend rider notification | ✅ |
| Auto-reject if restaurant doesn't accept in N min | Configurable (system config) | ✅ |
| Order tabs New/Preparing/Ready/… | `OrdersMain.jsx` | ✅ |
| Handover verification (code / QR) | Takeaway OTP only; delivery pickup is just "confirm" | 🟡 |
| KDS / ticket printing | — | ❌ |
| Restaurant self-created offers | Offers are created by **admin** (restaurant-scoped coupons); restaurant can only view | 🟡 |
| Advertising purchase | — | ❌ |
| Analytics (sales trends, best sellers…) | Limited (finance page, ratings) | 🟡 |
| Earnings, wallet, withdraw request | `/finance`, `/withdraw`, `/withdrawals` | ✅ |
| Formal settlement statements / batches | Pull-based withdrawals instead of scheduled settlement | 🟡 |
| Ratings & reviews view | `RatingsReviews.jsx` | ✅ |
| Complaints & support tickets | ✅ | ✅ |
| Delivery mode: platform / self / hybrid | Platform delivery only (`dispatchMode: 'auto'`) | 🟡 |
| Dining & takeaway settings | ✅ | ➕ |
| POS integration | — | ❌ |

---

## 8. Delivery partner app (Sec 32–37, Part 1 §6, Part 2 DEL-001…022)

| Feature | Project | Status |
|---|---|---|
| OTP login, registration | ✅ | ✅ |
| Docs: Aadhaar, PAN, licence, vehicle no./type, RC, bank | ✅ | ✅ |
| Insurance, emergency contact, background verification | — | ❌ |
| Document expiry tracking / reminders | — | ❌ |
| Approval: pending / approved / rejected + reverify | ✅ | ✅ |
| Online / offline | `/delivery/availability` | ✅ |
| Home stats (earnings, trips) | `DeliveryHomeV2`, `pocket-details` | ✅ |
| Order offer with accept / reject + timeout | ✅ | ✅ |
| Flow: accept → reached pickup → confirm pickup → reached drop → verify OTP → complete | ✅ matches SOP Sec 34–35 | ✅ |
| Pickup verification by code/QR | — | ❌ |
| Proof of delivery: OTP | ✅ | ✅ |
| Photo / signature proof | — | ❌ |
| Collect COD via QR | `/orders/:id/collect/qr` | ✅ ➕ |
| Navigation | Google Maps / Leaflet live map | ✅ |
| Earnings: commission rules (base/distance) | Delivery commission rules | ✅ |
| Incentives / quests | Earning add-ons with targets + history | ✅ |
| Bonus | Admin bonus | ✅ |
| Peak / surge / weekend pay | — | ❌ |
| Tips | — | ❌ |
| Wallet, withdraw, cash deposit, cash limit | ✅ | ✅ ➕ |
| Trip history | ✅ | ✅ |
| Performance (acceptance %, cancellation %) | Reviews only | 🟡 |
| SOS / emergency help | Emergency help numbers (admin-configured) | 🟡 |
| Support tickets | ✅ | ✅ |
| Referral | ✅ | ✅ |

---

## 9. Dispatch / allocation engine (Sec 38, Part 1 §8.9, §13)

| SOP requirement | Project (`order-dispatch.service.js`) | Status |
|---|---|---|
| Find nearby online riders | Geo query on online partners | ✅ |
| Rank by distance | Sorted by `distanceKm` | ✅ |
| Score by ETA, acceptance rate, workload, vehicle, reliability, fairness | Only distance + cash-limit filter | ❌ |
| Expand search when no rider | Radius 15 → 25 → 40 → 60 km | ✅ |
| Offer timeout → next rider | `processDispatchTimeout`, `offeredTo[]` | ✅ |
| Readiness-aware dispatch timing | — | ❌ |
| Atomic assignment (no double accept) | Verify locking in accept flow | 🟡 |
| Manual dispatch / reassign rider by admin | No admin reassign route | ❌ |
| Multi-order batching | "Multiorder setting" in admin | 🟡 |

---

## 10. Admin portal (Sec 56–68, 96–98, Part 1 §7, Part 2 ADM-001…034)

| Feature | Project | Status |
|---|---|---|
| Email + password login, forgot password via OTP | ✅ | ✅ |
| **Admin MFA** | — | ❌ |
| Dashboard KPIs | `/dashboard-stats`, sidebar badges, global search | ✅ |
| Charts / alerts (high cancellation, payment failures…) | Limited | 🟡 |
| Live operations map | — | ❌ |
| Customers: list, view, block, COD on/off | ✅ | ✅ |
| Restaurants: join requests, approve/reject, list, settings, top restaurants, complaints, reviews | ✅ | ✅ |
| Delivery partners: join requests, approve/reject, list, reviews, earnings, wallets | ✅ | ✅ |
| Suspend partner / assign zone | Verify (approve/reject/delete exist) | 🟡 |
| Orders: list, details, accept/reject, change status, delete, refund | ✅ | ✅ |
| Payment recovery & retry refund | `/orders/payment-recovery`, `/pending-refunds` | ✅ ➕ |
| Order cancel with compensation / escalation | — | ❌ |
| Zones (polygon) | ✅ | ✅ |
| Country → State → City → Zone hierarchy | Zones only | 🟡 |
| Delivery fee: slabs by distance, free-delivery threshold, per zone | `feeSettings` (`deliveryFeeRanges`, `freeDeliveryUpTo`, `zoneId`) | ✅ |
| Peak / rain / small-order fee | — | ❌ |
| Platform fee, packaging fee, GST rate | ✅ | ✅ |
| Commission per restaurant | `restaurantCommission` | ✅ |
| Category / city commission rules, effective dates | — | ❌ |
| Admin price markup rules | `foodPricingRule`, Pricing Management | ➕ |
| Coupons: %, flat, min order, max discount, usage & per-user limit, first order, restaurant scope, dates | ✅ | ✅ |
| Coupon by category / city / payment method / time-of-day / funding source | — | ❌ |
| Campaigns (basic / food) | **Mock UI, no API** | 🎨 |
| Advertisement (list, new, requests) | **Mock UI, no API** | 🎨 |
| Loyalty point report | **Mock UI, no API** | 🎨 |
| Employees / roles pages | **Mock UI, no API** (real thing = Sub-Admins) | 🎨 |
| Sub-admins with permissions | ✅ | ✅ |
| Broadcast push notifications | ✅ | ✅ |
| Notification templates (OTP, order, refund…) | — | ❌ |
| CMS: landing banners, about, terms, privacy, refund, shipping, cancellation, support pages | ✅ | ✅ |
| FAQ / help articles | Partial (support CMS page) | 🟡 |
| Reports: transaction, order, tax, restaurant, feedback | ✅ | ✅ |
| Analytics: DAU/MAU, retention, churn, conversion | — | ❌ |
| Review moderation (hide/restore, spam) | Only delete feedback | 🟡 |
| Support dashboard (SLA, assign agent, internal notes) | Ticket list + status update only | 🟡 |
| Withdrawals (restaurant & rider), cash confirmations, cash-limit settlement | ✅ | ✅ |
| Settlement batches, finance reconciliation screen | — | ❌ |
| Maintenance mode, business settings, customization settings | ✅ | ✅ |
| Feature flags (`ENABLE_COD`, `ENABLE_DINING`…) | Some toggles in business/customization settings; no general flag system | 🟡 |
| Audit log of admin actions (who/what/before/after/IP) | Only order `statusHistory` + pricing-rule history | ❌ |
| Queue dashboard | `/v1/admin/queues` | ➕ |

---

## 11. Payments, refunds, finance (Sec 17, 42, 78–79, 91–92, Part 1 §8.8, §8.12)

| Requirement | Project | Status |
|---|---|---|
| Gateway tokens, never store cards | Razorpay checkout | ✅ |
| Webhook + signature verification | `/v1/payments/webhook`, `razorpayWebhook.controller.js` | ✅ |
| Idempotent order creation | For online payments (per Razorpay order) | 🟡 |
| Pending-payment reconciliation job | `pendingOnlinePayment` + payment worker | ✅ |
| Modular / swappable gateway | Razorpay-specific helpers | 🟡 |
| Full refund to source or wallet, atomic claim, retry | ✅ | ✅ |
| Partial / item / delivery-fee refund | — | ❌ |
| Refund approval workflow (large refunds need extra approval) | — | ❌ |
| Transaction records | `FoodTransaction`, `transaction.model.js`, `transaction.service.js` | 🟡 |
| **Double-entry ledger** (customer payment, restaurant payable, platform revenue, tax…) | Not a formal ledger | ❌ |
| Settlement records | `settlement.model.js` / `settlement.service.js` exist (used from payment controller) | 🟡 |
| Daily reconciliation (gateway vs orders vs ledger) | — | ❌ |
| Restaurant-funded vs platform-funded discount split | Not tracked separately | ❌ |
| Invoices | User order invoice page; admin export | ✅ |

---

## 12. Notifications (Sec 67, 115, Part 1 §8.11)

| Channel / feature | Project | Status |
|---|---|---|
| Push (FCM) | ✅ | ✅ |
| In-app notifications | ✅ | ✅ |
| SMS | OTP only | 🟡 |
| Email | Admin password-reset only | 🟡 |
| WhatsApp | Only share links in FE | ❌ |
| Event-driven via queue | BullMQ notification worker | ✅ |
| Templates with variables | — | ❌ |
| Transactional vs promotional consent | — | ❌ |

---

## 13. Security, privacy, compliance (Sec 81, 83, 106–109, Part 1 §15)

| Requirement | Project | Status |
|---|---|---|
| JWT + refresh tokens | ✅ | ✅ |
| OTP rate limit + API rate limit | `authRateLimiter`, `privateRateLimiter` | ✅ |
| Helmet, XSS clean, mongo-sanitize | ✅ | ✅ |
| Password hashing (admin) | bcryptjs | ✅ |
| Env validation | `validateEnv.js` | ✅ |
| Request correlation ID | `requestId.js` | ✅ |
| Admin MFA | — | ❌ |
| Audit logging | — | ❌ |
| Delivery OTP hidden from rider (`select:false`) | ✅ | ✅ |
| Phone masking for restaurant/rider | Verify | 🟡 |
| Consent management, data-retention policy | — | ❌ |
| Location history retention policy | — | ❌ |
| Fraud / risk score engine | — | ❌ |
| Standard error codes (`ORDER_NOT_SERVICEABLE`, `PRICE_CHANGED`…) + `request_id` in error body | Errors are `{ success:false, message }` without error code | 🟡 |
| Backups / DR plan | Not in repo | ❌ |
| Secrets | Firebase admin JSON is kept **outside** repo (Downloads) — keep it out of git | ⚠️ note |

---

## 14. Quality, testing, ops (Part 1 §16.2, §21; Part 2 §15)

| Requirement | Project | Status |
|---|---|---|
| Unit / integration tests | None (`npm test` placeholder) | ❌ |
| E2E flow scripts | Ad-hoc scripts in `Backend/.claude-e2e/` (user → order → restaurant → rider → deliver) | 🟡 |
| OpenAPI / API spec | — | ❌ |
| CI/CD | — | ❌ |
| Separate env configs (dev/QA/staging/prod) | — | ❌ |
| Analytics event tracking (`APP_OPENED`, `ITEM_ADDED`…) | — | ❌ |
| Docs folder | `docs/` was empty before this file | ❌ |

---

## 15. Extra things in the project that the SOP does not ask for (or puts later)

- **Dining module** (table booking, dining categories/requests, banners) — SOP Version 3
- **Takeaway order type** with OTP handover
- **Admin price markup** (`markupAmount`, pricing rules) on top of restaurant price
- **Rider cash-limit system** (cash in hand limit, deposit, cash confirmations, QR collection)
- **Per-customer COD toggle**
- **Food & add-on approval** by admin before going live
- **Under-₹250, Gourmet / Top-10, Explore icons** landing sections
- **Safety emergency reports** (user) and **delivery emergency help**
- **Payment recovery dashboard** with retry refunds
- **Queue monitoring endpoint**

---

## 16. Priority gap list (suggested order to close)

**P0 — needed before real launch (SOP "critical")**
1. Explicit order state machine with allowed-transition table; restrict admin force-status with reason + audit.
2. Admin audit log (who / what / before / after / IP / reason).
3. Admin manual reassign rider + order escalation.
4. Generic idempotency key on order/payment APIs.
5. Ledger + daily reconciliation (gateway ↔ orders ↔ payouts).
6. Admin MFA.
7. Automated tests for the core order flow + CI.

**P1 — MVP completeness**
8. Favorites + Veg Mode + stock rules saved on backend (currently localStorage).
9. Scheduled-order release job.
10. Partial / item refunds + refund approval.
11. Pickup verification (order code/QR) for riders.
12. Rider documents: insurance, emergency contact, expiry tracking.
13. Standard error codes in API responses.
14. Notification templates; transactional SMS/email for order events.
15. Restaurant holiday/temporary closure, busy mode.

**P2 — Version 2 (growth)**
16. Restaurant branches & staff roles.
17. Restaurant self-service offers; restaurant- vs platform-funded discount split.
18. Rider tips, peak/surge pay, smarter dispatch scoring.
19. Wire up mock admin pages (Campaigns, Advertisement, Loyalty, Employees) or remove them.
20. Search upgrade (text index / OpenSearch), personalisation, dietary filters, combos.

**P3 — Version 3+**
21. Membership, gift cards, advertising platform, fraud/risk engine, KDS/POS, multi-language, native apps, analytics warehouse.

---

## 17. Decisions to take (stack mismatch)

The SOP's stack is a **recommendation**, not mandatory (Part 1 §16 says so). Decide explicitly:

| Topic | Option A — keep current | Option B — follow SOP |
|---|---|---|
| DB | MongoDB (works, geo indexes in place) | Migrate to PostgreSQL (large effort) |
| Mobile | React PWA (one codebase) | Flutter / native apps (better background GPS for riders, store presence) |
| Backend language | Express JS | NestJS + TypeScript (stronger contracts) |
| Queue | BullMQ on Redis | RabbitMQ / Kafka (only needed at much higher scale) |
| Search | Mongo regex / text index | OpenSearch |

Recommended: keep the current stack for launch, add TypeScript/OpenAPI gradually, and plan a **native or wrapped (Capacitor) rider app** because browser background GPS is unreliable for delivery partners.
