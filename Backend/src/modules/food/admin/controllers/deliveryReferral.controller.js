import * as deliveryReferralAdminService from '../services/deliveryReferralAdmin.service.js';

export async function getDeliveryReferralSettingsController(req, res, next) {
    try {
        const settings = await deliveryReferralAdminService.getDeliveryReferralSettings();
        res.status(200).json({ success: true, message: 'Delivery referral settings fetched successfully', data: { settings } });
    } catch (error) {
        next(error);
    }
}

export async function saveDeliveryReferralSettingsController(req, res, next) {
    try {
        const settings = await deliveryReferralAdminService.saveDeliveryReferralSettings(req.body || {});
        res.status(200).json({ success: true, message: 'Delivery referral settings saved successfully', data: { settings } });
    } catch (error) {
        next(error);
    }
}

export async function listDeliveryReferralsController(req, res, next) {
    try {
        const data = await deliveryReferralAdminService.listDeliveryReferrals(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery referrals fetched successfully', data });
    } catch (error) {
        next(error);
    }
}
