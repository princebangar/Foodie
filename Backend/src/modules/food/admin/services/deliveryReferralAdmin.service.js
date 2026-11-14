import mongoose from 'mongoose';
import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodReferralSettings } from '../models/referralSettings.model.js';
import { FoodReferralLog } from '../models/referralLog.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import {
    MAX_DELIVERY_REFERRALS,
    MAX_DELIVERY_REFERRAL_TIERS,
    buildRewardLadder,
    getActiveReferralSettingsDoc,
    getDeliveryReferralCode,
    normalizeDeliveryReferralConfig
} from '../../delivery/services/deliveryReferral.service.js';

const money = z.coerce.number().min(0, 'Amount cannot be negative').max(100000, 'Amount is too large');

const settingsSchema = z.object({
    enabled: z.boolean(),
    maxReferrals: z.coerce
        .number()
        .int('Max referrals must be a whole number')
        .min(0)
        .max(MAX_DELIVERY_REFERRALS, `Max referrals can be at most ${MAX_DELIVERY_REFERRALS}`),
    tiers: z.array(money).max(MAX_DELIVERY_REFERRAL_TIERS, `At most ${MAX_DELIVERY_REFERRAL_TIERS} referral levels`),
    defaultReward: money
});

const toAdminSettings = (doc) => {
    const config = normalizeDeliveryReferralConfig(doc);
    return {
        enabled: doc ? doc.deliveryReferralEnabled !== false : false,
        maxReferrals: config.maxReferrals,
        tiers: config.tiers,
        defaultReward: config.defaultReward,
        maxEarning: config.maxEarning,
        ladder: buildRewardLadder(config),
        updatedAt: doc?.updatedAt || null
    };
};

export async function getDeliveryReferralSettings() {
    return toAdminSettings(await getActiveReferralSettingsDoc());
}

export async function saveDeliveryReferralSettings(body = {}) {
    const parsed = settingsSchema.safeParse({
        enabled: Boolean(body.enabled),
        maxReferrals: body.maxReferrals ?? 0,
        tiers: Array.isArray(body.tiers) ? body.tiers : [],
        defaultReward: body.defaultReward ?? 0
    });
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

    const { enabled, maxReferrals, tiers, defaultReward } = parsed.data;
    if (enabled && maxReferrals < 1) {
        throw new ValidationError('Set max referrals to at least 1 to turn on Refer & Earn');
    }
    if (tiers.length > maxReferrals && maxReferrals > 0) {
        throw new ValidationError(`You added ${tiers.length} referral levels but max referrals is ${maxReferrals}`);
    }

    const $set = {
        deliveryReferralEnabled: enabled,
        referralLimitDelivery: maxReferrals,
        deliveryReferralTiers: tiers.map((t) => Math.round(t * 100) / 100),
        referralRewardDelivery: Math.round(defaultReward * 100) / 100
    };

    const existing = await FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).select('_id').lean();
    const saved = existing
        ? await FoodReferralSettings.findByIdAndUpdate(existing._id, { $set }, { new: true }).lean()
        : (await FoodReferralSettings.create({ ...$set, isActive: true })).toObject();

    return toAdminSettings(saved);
}

const STATUS_FILTERS = ['credited', 'rejected', 'pending'];

/** Referral history for the admin page, plus partners who signed up with a code and await approval. */
export async function listDeliveryReferrals(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const status = STATUS_FILTERS.includes(String(query.status)) ? String(query.status) : '';
    const search = String(query.search || '').trim();

    const filter = { role: 'DELIVERY_PARTNER' };
    if (status) filter.status = status;

    if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const or = [{ name: regex }, { phone: regex }];
        const codeSuffix = search.toUpperCase().replace(/^DP-?/, '');
        if (/^[A-F\d]{8}$/.test(codeSuffix)) {
            or.push({ $expr: { $eq: [{ $substrCP: [{ $toString: '$_id' }, 16, 8] }, codeSuffix.toLowerCase()] } });
        }
        const ids = await FoodDeliveryPartner.find({ $or: or }).select('_id').limit(500).lean();
        const idList = ids.map((p) => p._id);
        filter.$or = [{ referrerId: { $in: idList } }, { refereeId: { $in: idList } }];
    }

    const [logs, total, summaryAgg, awaitingApproval] = await Promise.all([
        FoodReferralLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        FoodReferralLog.countDocuments(filter),
        FoodReferralLog.aggregate([
            { $match: { role: 'DELIVERY_PARTNER' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    credited: { $sum: { $cond: [{ $eq: ['$status', 'credited'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'credited'] }, '$rewardAmount', 0] } },
                    referrers: { $addToSet: '$referrerId' }
                }
            }
        ]),
        FoodDeliveryPartner.countDocuments({ referredBy: { $ne: null }, status: 'pending' })
    ]);

    const partnerIds = new Set();
    logs.forEach((log) => {
        partnerIds.add(String(log.referrerId));
        partnerIds.add(String(log.refereeId));
    });
    const partners = partnerIds.size
        ? await FoodDeliveryPartner.find({
            _id: { $in: [...partnerIds].filter((v) => mongoose.Types.ObjectId.isValid(v)) }
        })
            .select('_id name phone status')
            .lean()
        : [];
    const byId = new Map(partners.map((p) => [String(p._id), p]));

    const describe = (rawId) => {
        const p = byId.get(String(rawId));
        return {
            id: String(rawId),
            code: getDeliveryReferralCode(rawId),
            name: p?.name || 'Deleted partner',
            phone: p?.phone || '',
            status: p?.status || 'deleted'
        };
    };

    const summary = summaryAgg?.[0] || {};
    return {
        summary: {
            totalReferrals: Number(summary.total || 0),
            credited: Number(summary.credited || 0),
            notEligible: Number(summary.rejected || 0),
            totalPaid: Math.round(Number(summary.totalPaid || 0) * 100) / 100,
            activeReferrers: Array.isArray(summary.referrers) ? summary.referrers.length : 0,
            awaitingApproval: Number(awaitingApproval || 0)
        },
        referrals: logs.map((log) => ({
            id: String(log._id),
            referrer: describe(log.referrerId),
            referee: describe(log.refereeId),
            referralNumber: Number(log.referralNumber) || 0,
            rewardAmount: Number(log.rewardAmount) || 0,
            status: log.status,
            reason: log.reason || '',
            createdAt: log.createdAt
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
}
