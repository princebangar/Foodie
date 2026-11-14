import mongoose from 'mongoose';
import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';
import { config } from '../../../../config/env.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodDiamondSettings } from '../models/diamondSettings.model.js';
import { FoodDiamondMembership } from '../models/diamondMembership.model.js';
import {
    assertRazorpayPaymentMatches,
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayInstance,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature
} from '../../orders/helpers/razorpay.helper.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CANCELLED_STATUSES = ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'];
const money = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

let settingsCache = { doc: undefined, at: 0 };
const SETTINGS_TTL_MS = 30 * 1000;

export async function getDiamondSettingsDoc({ fresh = false } = {}) {
    if (!fresh && settingsCache.doc !== undefined && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
        return settingsCache.doc;
    }
    const doc = await FoodDiamondSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    settingsCache = { doc: doc || null, at: Date.now() };
    return settingsCache.doc;
}

const normalizeSettings = (doc) => ({
    enabled: Boolean(doc?.enabled),
    price: money(doc?.price),
    originalPrice: money(doc?.originalPrice),
    durationDays: Math.max(1, Math.floor(Number(doc?.durationDays) || 90)),
    freeDelivery: {
        enabled: doc?.freeDelivery?.enabled !== false && Boolean(doc),
        minOrderValue: money(doc?.freeDelivery?.minOrderValue),
        maxDistanceKm: Math.max(0, Number(doc?.freeDelivery?.maxDistanceKm) || 0)
    },
    freePlatformFee: { enabled: Boolean(doc?.freePlatformFee?.enabled) },
    extraDiscount: {
        enabled: doc?.extraDiscount?.enabled !== false && Boolean(doc),
        percent: Math.min(100, Math.max(0, Number(doc?.extraDiscount?.percent) || 0)),
        maxDiscount: money(doc?.extraDiscount?.maxDiscount),
        minOrderValue: money(doc?.extraDiscount?.minOrderValue)
    },
    customBenefits: Array.isArray(doc?.customBenefits)
        ? doc.customBenefits.map((b) => ({ title: String(b.title || ''), description: String(b.description || '') }))
        : [],
    terms: String(doc?.terms || ''),
    updatedAt: doc?.updatedAt || null
});

export const durationLabel = (days) => {
    if (days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
    if (days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
    return days === 1 ? '1 day' : `${days} days`;
};

/** Benefit cards shown to users; built from the same values pricing uses. */
export function buildBenefits(s) {
    const list = [];
    if (s.freeDelivery.enabled) {
        const parts = [];
        parts.push(s.freeDelivery.minOrderValue > 0 ? `On orders above ${rupees(s.freeDelivery.minOrderValue)}` : 'On every delivery order');
        if (s.freeDelivery.maxDistanceKm > 0) parts.push(`from restaurants within ${s.freeDelivery.maxDistanceKm} km`);
        list.push({ key: 'free_delivery', title: 'Free delivery', description: `${parts.join(' ')}.` });
    }
    if (s.extraDiscount.enabled && s.extraDiscount.percent > 0) {
        const parts = ['Above all existing offers'];
        if (s.extraDiscount.minOrderValue > 0) parts.push(`on orders above ${rupees(s.extraDiscount.minOrderValue)}`);
        if (s.extraDiscount.maxDiscount > 0) parts.push(`(max ${rupees(s.extraDiscount.maxDiscount)} per order)`);
        list.push({ key: 'extra_discount', title: `Up to ${s.extraDiscount.percent}% extra off`, description: `${parts.join(' ')}.` });
    }
    if (s.freePlatformFee.enabled) {
        list.push({ key: 'free_platform_fee', title: 'No platform fee', description: 'Platform fee is waived on every order.' });
    }
    s.customBenefits.forEach((b, i) => list.push({ key: `custom_${i}`, title: b.title, description: b.description }));
    return list;
}

const toPublicPlan = (s) => ({
    enabled: s.enabled,
    price: s.price,
    originalPrice: s.originalPrice > s.price ? s.originalPrice : 0,
    durationDays: s.durationDays,
    durationLabel: durationLabel(s.durationDays),
    extraDiscountPercent: s.extraDiscount.enabled ? s.extraDiscount.percent : 0,
    benefits: buildBenefits(s),
    hasTerms: s.terms.trim().length > 0
});

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

const toObjectId = (id) => (mongoose.Types.ObjectId.isValid(String(id || '')) ? new mongoose.Types.ObjectId(String(id)) : null);

/** Active memberships that have not ended, oldest first (a renewal sits after the current one). */
async function getLiveMemberships(userId) {
    const oid = toObjectId(userId);
    if (!oid) return [];
    return FoodDiamondMembership.find({ userId: oid, status: 'active', endAt: { $gt: new Date() } })
        .sort({ startAt: 1 })
        .lean();
}

/** Is the user a Diamond member right now? Returns { isMember, since, endAt }. */
export async function getMembershipStatus(userId) {
    const live = await getLiveMemberships(userId);
    const now = Date.now();
    const current = live.find((m) => new Date(m.startAt).getTime() <= now);
    if (!current) return { isMember: false, since: null, endAt: null };
    return {
        isMember: true,
        since: current.startAt,
        // Renewals continue right after, so "member till" is the last end date.
        endAt: live[live.length - 1].endAt
    };
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** What Diamond takes off one order. Pure: used for members and for the "you could save" hint. */
export function computeDiamondSavings(s, { subtotal, deliveryFee, platformFee, orderType, distanceKm, couponDiscount }) {
    let delivery = 0;
    if (
        s.freeDelivery.enabled &&
        orderType !== 'takeaway' &&
        deliveryFee > 0 &&
        subtotal >= s.freeDelivery.minOrderValue &&
        (s.freeDelivery.maxDistanceKm <= 0 || (Number.isFinite(distanceKm) && distanceKm <= s.freeDelivery.maxDistanceKm))
    ) {
        delivery = money(deliveryFee);
    }

    const platform = s.freePlatformFee.enabled && platformFee > 0 ? money(platformFee) : 0;

    let discount = 0;
    if (s.extraDiscount.enabled && s.extraDiscount.percent > 0 && subtotal >= s.extraDiscount.minOrderValue) {
        let raw = (subtotal * s.extraDiscount.percent) / 100;
        if (s.extraDiscount.maxDiscount > 0) raw = Math.min(raw, s.extraDiscount.maxDiscount);
        // Never discount below zero once the coupon is applied.
        raw = Math.min(raw, Math.max(0, subtotal - (Number(couponDiscount) || 0)));
        discount = Math.max(0, Math.floor(raw));
    }

    return { delivery, platformFee: platform, discount, total: money(delivery + platform + discount) };
}

/**
 * Called from calculateOrderPricing. For members the savings are applied; for others,
 * when Diamond is on sale, `offer` says how much they would have saved.
 */
export async function resolveDiamondPricing(userId, ctx) {
    const doc = await getDiamondSettingsDoc();
    if (!doc) return { isMember: false, savings: null, offer: null };
    const s = normalizeSettings(doc);

    const status = userId ? await getMembershipStatus(userId) : { isMember: false };
    if (status.isMember) {
        return { isMember: true, savings: computeDiamondSavings(s, ctx), offer: null };
    }
    if (!s.enabled || s.price <= 0) return { isMember: false, savings: null, offer: null };
    const potential = computeDiamondSavings(s, ctx);
    return {
        isMember: false,
        savings: null,
        offer: potential.total > 0 ? { potentialSavings: potential.total, price: s.price, durationLabel: durationLabel(s.durationDays) } : null
    };
}

// ---------------------------------------------------------------------------
// User: page data, purchase
// ---------------------------------------------------------------------------

async function getSavingsSince(userId, since) {
    const oid = toObjectId(userId);
    if (!oid || !since) return { delivery: 0, deliveryCount: 0, discount: 0, discountCount: 0, platformFee: 0, platformFeeCount: 0, total: 0 };
    const [row] = await FoodOrder.aggregate([
        {
            $match: {
                userId: oid,
                createdAt: { $gte: new Date(since) },
                orderStatus: { $nin: CANCELLED_STATUSES },
                'pricing.diamondSavings.total': { $gt: 0 }
            }
        },
        {
            $group: {
                _id: null,
                delivery: { $sum: '$pricing.diamondSavings.delivery' },
                deliveryCount: { $sum: { $cond: [{ $gt: ['$pricing.diamondSavings.delivery', 0] }, 1, 0] } },
                discount: { $sum: '$pricing.diamondSavings.discount' },
                discountCount: { $sum: { $cond: [{ $gt: ['$pricing.diamondSavings.discount', 0] }, 1, 0] } },
                platformFee: { $sum: '$pricing.diamondSavings.platformFee' },
                platformFeeCount: { $sum: { $cond: [{ $gt: ['$pricing.diamondSavings.platformFee', 0] }, 1, 0] } },
                total: { $sum: '$pricing.diamondSavings.total' }
            }
        }
    ]);
    return {
        delivery: money(row?.delivery),
        deliveryCount: row?.deliveryCount || 0,
        discount: money(row?.discount),
        discountCount: row?.discountCount || 0,
        platformFee: money(row?.platformFee),
        platformFeeCount: row?.platformFeeCount || 0,
        total: money(row?.total)
    };
}

/** Everything the user's Diamond screens need. */
export async function getUserDiamond(userId) {
    await reconcilePendingDiamond(userId).catch(() => {});
    const s = normalizeSettings(await getDiamondSettingsDoc());
    const status = await getMembershipStatus(userId);
    const savings = status.isMember ? await getSavingsSince(userId, status.since) : null;
    return {
        plan: toPublicPlan(s),
        membership: {
            isMember: status.isMember,
            since: status.since,
            endAt: status.endAt,
            daysLeft: status.endAt ? Math.max(0, Math.ceil((new Date(status.endAt).getTime() - Date.now()) / DAY_MS)) : 0
        },
        savings
    };
}

export async function getDiamondTerms() {
    const s = normalizeSettings(await getDiamondSettingsDoc());
    return { terms: s.terms };
}

export async function createDiamondOrder(userId) {
    const oid = toObjectId(userId);
    if (!oid) throw new ValidationError('User not found');
    const s = normalizeSettings(await getDiamondSettingsDoc({ fresh: true }));
    if (!s.enabled || s.price <= 0) throw new ValidationError('Foodie Diamond is not available right now');

    const amountPaise = Math.round(s.price * 100);
    let razorpay;
    if (!isRazorpayConfigured()) {
        if (config.nodeEnv === 'production') throw new ValidationError('Payment gateway is not configured');
        razorpay = { key: getRazorpayKeyId() || 'rzp_test_dummy', orderId: `order_dev_diamond_${Date.now()}`, amount: amountPaise, currency: 'INR' };
    } else {
        const order = await createRazorpayOrder(amountPaise, 'INR', `diamond_${String(oid).slice(-8)}_${Date.now()}`);
        razorpay = { key: getRazorpayKeyId(), orderId: String(order.id), amount: Number(order.amount) || amountPaise, currency: order.currency || 'INR' };
    }

    // Price and duration are fixed now, so a later admin change can't alter this purchase.
    await FoodDiamondMembership.create({
        userId: oid,
        status: 'pending',
        amount: s.price,
        durationDays: s.durationDays,
        payment: { method: isRazorpayConfigured() ? 'razorpay' : 'dev', razorpayOrderId: razorpay.orderId }
    });

    return { razorpay, amount: s.price, durationLabel: durationLabel(s.durationDays) };
}

export async function verifyDiamondPayment(userId, payload = {}) {
    const oid = toObjectId(userId);
    const orderId = String(payload.razorpayOrderId || '').trim();
    const paymentId = String(payload.razorpayPaymentId || '').trim();
    const signature = String(payload.razorpaySignature || '').trim();
    if (!oid) throw new ValidationError('User not found');
    if (!orderId || !paymentId || !signature) throw new ValidationError('Payment details are missing');

    const intent = await FoodDiamondMembership.findOne({ userId: oid, 'payment.razorpayOrderId': orderId }).lean();
    if (!intent) throw new ValidationError('Payment not found');
    if (intent.status === 'active') return getUserDiamond(userId);
    if (intent.status !== 'pending') throw new ValidationError('This payment can no longer be used');

    if (intent.payment?.method === 'razorpay') {
        if (!verifyPaymentSignature(orderId, paymentId, signature)) throw new ValidationError('Payment verification failed');
        try {
            const rzPayment = await fetchRazorpayPayment(paymentId);
            assertRazorpayPaymentMatches(rzPayment, { orderId, amountPaise: Math.round(intent.amount * 100) });
        } catch (err) {
            throw new ValidationError(err?.message || 'Payment verification failed');
        }
    } else if (config.nodeEnv === 'production') {
        throw new ValidationError('Payment gateway is not configured');
    }

    await activateIntent(intent, paymentId, signature);
    return getUserDiamond(userId);
}

/** Turns a paid pending purchase into an active membership. A renewal starts when the current one ends. */
async function activateIntent(intent, paymentId, signature = '') {
    const live = await getLiveMemberships(intent.userId);
    const lastEnd = live.length ? new Date(live[live.length - 1].endAt).getTime() : 0;
    const start = new Date(Math.max(Date.now(), lastEnd));
    const end = new Date(start.getTime() + intent.durationDays * DAY_MS);

    // Only one request can flip pending -> active.
    const res = await FoodDiamondMembership.updateOne(
        { _id: intent._id, status: 'pending' },
        {
            $set: {
                status: 'active',
                startAt: start,
                endAt: end,
                'payment.razorpayPaymentId': paymentId,
                'payment.razorpaySignature': signature,
                'payment.paidAt': new Date()
            }
        }
    );
    return res.modifiedCount === 1;
}

const RECONCILE_WINDOW_MS = 48 * 60 * 60 * 1000;
const reconcileCheckedAt = new Map();

/**
 * Safety net for "paid but the app closed before verify": asks Razorpay whether any of the
 * user's recent pending Diamond orders was paid and activates it. Old unpaid ones become failed.
 */
export async function reconcilePendingDiamond(userId) {
    const oid = toObjectId(userId);
    if (!oid) return;
    const key = String(oid);
    if (Date.now() - (reconcileCheckedAt.get(key) || 0) < 30 * 1000) return;
    reconcileCheckedAt.set(key, Date.now());

    const cutoff = new Date(Date.now() - RECONCILE_WINDOW_MS);
    await FoodDiamondMembership.updateMany({ userId: oid, status: 'pending', createdAt: { $lt: cutoff } }, { $set: { status: 'failed' } });

    const pending = await FoodDiamondMembership.find({ userId: oid, status: 'pending', 'payment.method': 'razorpay', createdAt: { $gte: cutoff } })
        .sort({ createdAt: 1 })
        .limit(5)
        .lean();
    if (!pending.length) return;
    const rz = getRazorpayInstance();
    if (!rz) return;

    for (const intent of pending) {
        try {
            const res = await rz.orders.fetchPayments(intent.payment.razorpayOrderId);
            const paid = (res?.items || []).find(
                (p) => ['captured', 'authorized'].includes(p.status) && Number(p.amount) === Math.round(intent.amount * 100)
            );
            if (paid) await activateIntent(intent, paid.id);
        } catch {
            // Razorpay unreachable: try again on the next visit.
        }
    }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const amount = z.coerce.number().min(0, 'Amount cannot be negative').max(1000000, 'Amount is too large');
const adminSettingsSchema = z.object({
    enabled: z.boolean(),
    price: amount,
    originalPrice: amount,
    durationDays: z.coerce.number().int('Duration must be whole days').min(1, 'Duration must be at least 1 day').max(3650, 'Duration is too long'),
    freeDelivery: z.object({ enabled: z.boolean(), minOrderValue: amount, maxDistanceKm: z.coerce.number().min(0).max(100) }),
    freePlatformFee: z.object({ enabled: z.boolean() }),
    extraDiscount: z.object({
        enabled: z.boolean(),
        percent: z.coerce.number().min(0).max(100, 'Discount can be at most 100%'),
        maxDiscount: amount,
        minOrderValue: amount
    }),
    customBenefits: z
        .array(z.object({ title: z.string().trim().min(1, 'Every extra benefit needs a title').max(80), description: z.string().trim().max(240).default('') }))
        .max(10, 'At most 10 extra benefits'),
    terms: z.string().max(20000, 'Terms are too long')
});

export async function getAdminDiamondSettings() {
    return normalizeSettings(await getDiamondSettingsDoc({ fresh: true }));
}

export async function saveAdminDiamondSettings(body = {}) {
    const parsed = adminSettingsSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const data = parsed.data;
    if (data.enabled && data.price <= 0) throw new ValidationError('Set a price above ₹0 to start selling Diamond');
    if (data.extraDiscount.enabled && data.extraDiscount.percent <= 0) throw new ValidationError('Set the extra discount % or turn it off');

    const existing = await FoodDiamondSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).select('_id').lean();
    if (existing) await FoodDiamondSettings.updateOne({ _id: existing._id }, { $set: data });
    else await FoodDiamondSettings.create({ ...data, isActive: true });

    settingsCache = { doc: undefined, at: 0 };
    return getAdminDiamondSettings();
}

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listDiamondMembers(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const status = ['active', 'expired'].includes(String(query.status)) ? String(query.status) : '';
    const search = String(query.search || '').trim();
    const now = new Date();

    const filter = { status: 'active' };
    if (status === 'active') filter.endAt = { $gt: now };
    if (status === 'expired') filter.endAt = { $lte: now };
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        const users = await FoodUser.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(200).lean();
        filter.userId = { $in: users.map((u) => u._id) };
    }

    const [rows, total, summaryRow, liveUsers, savingsRow] = await Promise.all([
        FoodDiamondMembership.find(filter).sort({ 'payment.paidAt': -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        FoodDiamondMembership.countDocuments(filter),
        FoodDiamondMembership.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, revenue: { $sum: '$amount' }, purchases: { $sum: 1 } } }]),
        FoodDiamondMembership.distinct('userId', { status: 'active', startAt: { $lte: now }, endAt: { $gt: now } }),
        FoodOrder.aggregate([
            { $match: { orderStatus: { $nin: CANCELLED_STATUSES }, 'pricing.diamondSavings.total': { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$pricing.diamondSavings.total' }, orders: { $sum: 1 } } }
        ])
    ]);

    const users = await FoodUser.find({ _id: { $in: rows.map((r) => r.userId) } }).select('name phone email').lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    return {
        summary: {
            activeMembers: liveUsers.length,
            purchases: summaryRow[0]?.purchases || 0,
            revenue: money(summaryRow[0]?.revenue),
            savingsGiven: money(savingsRow[0]?.total),
            ordersWithSavings: savingsRow[0]?.orders || 0
        },
        members: rows.map((r) => {
            const u = userById.get(String(r.userId)) || {};
            const live = new Date(r.endAt).getTime() > now.getTime();
            const upcoming = live && new Date(r.startAt).getTime() > now.getTime();
            return {
                id: String(r._id),
                user: { id: String(r.userId), name: String(u.name || '').trim() || 'User', phone: u.phone || '', email: u.email || '' },
                amount: money(r.amount),
                durationDays: r.durationDays,
                startAt: r.startAt,
                endAt: r.endAt,
                paidAt: r.payment?.paidAt || r.createdAt,
                paymentId: r.payment?.razorpayPaymentId || '',
                state: upcoming ? 'upcoming' : live ? 'active' : 'expired'
            };
        }),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
}
