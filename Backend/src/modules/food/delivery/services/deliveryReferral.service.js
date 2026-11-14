import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { FoodReferralSettings } from '../../admin/models/referralSettings.model.js';
import { FoodReferralLog } from '../../admin/models/referralLog.model.js';
import { FoodSystemConfig } from '../../admin/models/systemConfig.model.js';

/** Admin > Customization Settings > "Delivery Refer & Earn". ON unless the admin turned it off. */
export const isDeliveryReferEarnVisible = async () => {
    const doc = await FoodSystemConfig.findOne({ key: 'delivery_refer_earn_enabled' }).select('value').lean();
    return doc ? doc.value === true : true;
};

export const MAX_DELIVERY_REFERRAL_TIERS = 50;
export const MAX_DELIVERY_REFERRALS = 1000;

const toMoney = (value) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);

/** Public referral code shown to partners: same as their Delivery ID (DP-XXXXXXXX). */
export const getDeliveryReferralCode = (partnerId) => {
    const id = String(partnerId || '');
    return id.length >= 8 ? `DP-${id.slice(-8).toUpperCase()}` : '';
};

/** Public website origin used in invite links (PUBLIC_WEB_URL, else the first FRONTEND_URL). */
const getPublicWebUrl = () =>
    String(process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || '')
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');

/** Short invite link, e.g. https://foodie.in/join/DP-6E84A43B */
export const buildDeliveryInviteLink = (code) => {
    const base = getPublicWebUrl();
    return base && code ? `${base}/join/${encodeURIComponent(code)}` : '';
};

export const buildDeliveryShareMessage = (code, link) =>
    [
        'Hey! I deliver with Foodie and earn on my own schedule.',
        `Join as a delivery partner using my referral code ${code}.`,
        '',
        link ? `Sign up here: ${link}` : ''
    ]
        .join('\n')
        .trim();

export const getActiveReferralSettingsDoc = () =>
    FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();

/**
 * Turns the stored settings document into the delivery refer & earn config.
 * Reward for referral #n = tiers[n - 1] when defined, else defaultReward. Credits stop after maxReferrals.
 */
export const normalizeDeliveryReferralConfig = (settingsDoc) => {
    const tiers = (Array.isArray(settingsDoc?.deliveryReferralTiers) ? settingsDoc.deliveryReferralTiers : [])
        .slice(0, MAX_DELIVERY_REFERRAL_TIERS)
        .map(toMoney);
    const maxReferrals = Math.min(
        MAX_DELIVERY_REFERRALS,
        Math.max(0, Math.floor(Number(settingsDoc?.referralLimitDelivery) || 0))
    );
    const defaultReward = toMoney(settingsDoc?.referralRewardDelivery);
    const enabled = settingsDoc ? settingsDoc.deliveryReferralEnabled !== false : false;

    const rewardFor = (referralNumber) => {
        const n = Math.floor(Number(referralNumber) || 0);
        if (n < 1 || n > maxReferrals) return 0;
        return n <= tiers.length ? tiers[n - 1] : defaultReward;
    };

    let maxEarning = 0;
    for (let n = 1; n <= maxReferrals; n += 1) maxEarning += rewardFor(n);

    return {
        enabled: enabled && maxReferrals > 0,
        enabledFlag: enabled,
        maxReferrals,
        tiers,
        defaultReward,
        maxEarning: toMoney(maxEarning),
        rewardFor
    };
};

/** Reward ladder for display: one row per tier, then the "after that" amount if referrals remain. */
export const buildRewardLadder = (config) => {
    const rows = config.tiers
        .slice(0, config.maxReferrals)
        .map((amount, idx) => ({ referralNumber: idx + 1, amount }));
    const remainingAfterTiers = Math.max(0, config.maxReferrals - rows.length);
    return {
        rows,
        afterTiers: remainingAfterTiers > 0
            ? { fromReferral: rows.length + 1, toReferral: config.maxReferrals, amount: config.defaultReward }
            : null
    };
};

/**
 * Finds the referring partner from a referral code: their Mongo id, or their
 * Delivery ID ("DP-6E84A43B" / "6E84A43B").
 */
export const resolveDeliveryReferrer = async (refRaw) => {
    const ref = String(refRaw || '').trim();
    if (!ref) return null;

    if (mongoose.Types.ObjectId.isValid(ref) && /^[a-f\d]{24}$/i.test(ref)) {
        return FoodDeliveryPartner.findById(ref).select('_id status').lean();
    }

    const suffix = ref.toUpperCase().replace(/^DP-?/, '');
    if (!/^[A-F\d]{8}$/.test(suffix)) return null;

    const matches = await FoodDeliveryPartner.find({
        $expr: { $eq: [{ $substrCP: [{ $toString: '$_id' }, 16, 8] }, suffix.toLowerCase()] }
    })
        .select('_id status')
        .limit(2)
        .lean();
    // An ambiguous code must never credit the wrong partner.
    return matches.length === 1 ? matches[0] : null;
};

/**
 * Called after admin approves a new delivery partner. Credits the referrer the
 * reward for their next referral slot. Safe to call more than once per partner.
 * `addBonus` credits pocket balance (admin.service addDeliveryPartnerBonus), passed in to avoid a circular import.
 */
export const creditDeliveryReferralOnApproval = async (approvedPartner, { addBonus }) => {
    const referrerId = approvedPartner?.referredBy ? String(approvedPartner.referredBy) : '';
    if (!referrerId || !mongoose.Types.ObjectId.isValid(referrerId)) return null;
    if (String(referrerId) === String(approvedPartner._id)) return null;

    // Claim the one-log-per-referee slot first; a duplicate key means it was already handled.
    let log;
    try {
        log = await FoodReferralLog.create({
            referrerId: new mongoose.Types.ObjectId(referrerId),
            refereeId: approvedPartner._id,
            role: 'DELIVERY_PARTNER',
            rewardAmount: 0,
            status: 'pending'
        });
    } catch (err) {
        if (err?.code === 11000) return null;
        throw err;
    }

    const reject = (reason) =>
        FoodReferralLog.updateOne({ _id: log._id }, { $set: { status: 'rejected', reason } });

    const [settingsDoc, visible] = await Promise.all([getActiveReferralSettingsDoc(), isDeliveryReferEarnVisible()]);
    if (!visible) return reject('feature_hidden');
    const config = normalizeDeliveryReferralConfig(settingsDoc);
    if (!config.enabledFlag) return reject('referral_disabled');
    if (config.maxReferrals <= 0) return reject('limit_disabled');

    const referrer = await FoodDeliveryPartner.findById(referrerId).select('_id status').lean();
    if (!referrer) return reject('referrer_not_found');
    if (referrer.status !== 'approved') return reject('referrer_not_approved');

    // Atomically take the next referral slot so parallel approvals can't exceed the limit.
    const claimed = await FoodDeliveryPartner.findOneAndUpdate(
        { _id: referrer._id, referralCount: { $lt: config.maxReferrals } },
        { $inc: { referralCount: 1 } },
        { new: true, projection: { referralCount: 1 } }
    ).lean();
    if (!claimed) return reject('limit_reached');

    const referralNumber = Number(claimed.referralCount) || 0;
    const reward = config.rewardFor(referralNumber);

    try {
        if (reward > 0) {
            await addBonus(
                {
                    deliveryPartnerId: String(referrer._id),
                    amount: reward,
                    reference: `Referral bonus (#${referralNumber})`
                },
                null
            );
        }
    } catch (err) {
        await FoodDeliveryPartner.updateOne({ _id: referrer._id, referralCount: { $gt: 0 } }, { $inc: { referralCount: -1 } });
        await reject('credit_failed');
        throw err;
    }

    await FoodReferralLog.updateOne(
        { _id: log._id },
        { $set: { status: 'credited', rewardAmount: reward, referralNumber } }
    );
    return { referralNumber, reward };
};

const maskPhone = (raw) => {
    const phone = String(raw || '');
    if (phone.length <= 4) return phone;
    return `${phone.slice(0, 2)}${'*'.repeat(phone.length - 4)}${phone.slice(-2)}`;
};

/** Everything the partner's Refer & Earn screen needs. */
export const getDeliveryReferralDetails = async (deliveryPartnerId) => {
    const id = String(deliveryPartnerId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Delivery partner not found');
    }
    const oid = new mongoose.Types.ObjectId(id);

    // Hidden from Customization Settings: the app shows nothing, so send nothing.
    if (!(await isDeliveryReferEarnVisible())) return { visible: false };

    const [partner, settingsDoc, logs, invitedPartners] = await Promise.all([
        FoodDeliveryPartner.findById(oid).select('_id referralCount').lean(),
        getActiveReferralSettingsDoc(),
        FoodReferralLog.find({ referrerId: oid, role: 'DELIVERY_PARTNER' }).sort({ createdAt: -1 }).limit(200).lean(),
        FoodDeliveryPartner.find({ referredBy: oid })
            .select('_id name phone status createdAt approvedAt')
            .sort({ createdAt: -1 })
            .limit(200)
            .lean()
    ]);
    if (!partner) throw new ValidationError('Delivery partner not found');

    const config = normalizeDeliveryReferralConfig(settingsDoc);
    const referralCount = Number(partner.referralCount) || 0;
    const remaining = Math.max(0, config.maxReferrals - referralCount);
    const logByReferee = new Map(logs.map((log) => [String(log.refereeId), log]));

    const invited = invitedPartners.map((p) => {
        const log = logByReferee.get(String(p._id));
        let status = 'pending_approval';
        if (log?.status === 'credited') status = 'credited';
        else if (log?.status === 'rejected') status = 'not_eligible';
        else if (p.status === 'rejected') status = 'application_rejected';
        else if (p.status === 'approved') status = 'approved';

        return {
            id: String(p._id),
            name: String(p.name || '').trim() || 'Delivery partner',
            phone: maskPhone(p.phone),
            status,
            reason: log?.reason || '',
            referralNumber: Number(log?.referralNumber) || 0,
            rewardAmount: log?.status === 'credited' ? toMoney(log.rewardAmount) : 0,
            joinedAt: p.createdAt || null
        };
    });

    const totalReferralEarnings = toMoney(
        logs.filter((log) => log.status === 'credited').reduce((sum, log) => sum + (Number(log.rewardAmount) || 0), 0)
    );

    const code = getDeliveryReferralCode(oid);
    const shareLink = buildDeliveryInviteLink(code);

    return {
        visible: true,
        code,
        shareLink,
        shareMessage: buildDeliveryShareMessage(code, shareLink),
        enabled: config.enabled,
        maxReferrals: config.maxReferrals,
        defaultReward: config.defaultReward,
        maxEarning: config.maxEarning,
        ladder: buildRewardLadder(config),
        referralCount,
        remaining,
        nextReward: config.enabled && remaining > 0 ? config.rewardFor(referralCount + 1) : 0,
        totalReferralEarnings,
        pendingCount: invited.filter((i) => i.status === 'pending_approval').length,
        invited
    };
};

/** Lightweight summary (profile banner). Keeps the old `rewardAmount` field for existing clients. */
export const getDeliveryReferralStats = async (deliveryPartnerId) => {
    const details = await getDeliveryReferralDetails(deliveryPartnerId);
    if (!details.visible) return { visible: false, enabled: false, rewardAmount: 0 };
    return {
        visible: true,
        code: details.code,
        enabled: details.enabled,
        referralCount: details.referralCount,
        remaining: details.remaining,
        maxReferrals: details.maxReferrals,
        maxEarning: details.maxEarning,
        nextReward: details.nextReward,
        totalReferralEarnings: details.totalReferralEarnings,
        rewardAmount: details.nextReward
    };
};

/** Public data for the invite page (/join/:code). Only the referrer's first name is exposed. */
export const getDeliveryReferralInvite = async (codeRaw) => {
    const [referrer, visible] = await Promise.all([
        resolveDeliveryReferrer(codeRaw).catch(() => null),
        isDeliveryReferEarnVisible()
    ]);
    if (!visible || !referrer || referrer.status !== 'approved') {
        return { valid: false, code: '', referrerName: '' };
    }
    const doc = await FoodDeliveryPartner.findById(referrer._id).select('name').lean();
    const firstName = String(doc?.name || '').trim().split(/\s+/)[0] || '';
    return { valid: true, code: getDeliveryReferralCode(referrer._id), referrerName: firstName };
};
