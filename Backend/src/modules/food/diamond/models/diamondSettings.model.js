import mongoose from 'mongoose';

/**
 * Foodie Diamond plan, set by admin (one active document).
 * Benefits are applied server-side in order pricing (see diamond.service.js).
 */
const customBenefitSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true, required: true, maxlength: 80 },
        description: { type: String, trim: true, default: '', maxlength: 240 }
    },
    { _id: false }
);

const diamondSettingsSchema = new mongoose.Schema(
    {
        /** New purchases are allowed only when ON. Existing members keep their benefits. */
        enabled: { type: Boolean, default: false },
        price: { type: Number, min: 0, default: 0 },
        /** Optional "was" price shown struck through. */
        originalPrice: { type: Number, min: 0, default: 0 },
        durationDays: { type: Number, min: 1, default: 90 },

        freeDelivery: {
            enabled: { type: Boolean, default: true },
            minOrderValue: { type: Number, min: 0, default: 0 },
            /** 0 = any distance */
            maxDistanceKm: { type: Number, min: 0, default: 0 }
        },
        freePlatformFee: {
            enabled: { type: Boolean, default: false }
        },
        extraDiscount: {
            enabled: { type: Boolean, default: true },
            /** Shown as "Up to X% extra off". */
            percent: { type: Number, min: 0, max: 100, default: 0 },
            /** 0 = no cap */
            maxDiscount: { type: Number, min: 0, default: 0 },
            minOrderValue: { type: Number, min: 0, default: 0 }
        },
        /** Display-only extra perks, e.g. "Priority support". */
        customBenefits: { type: [customBenefitSchema], default: [] },
        terms: { type: String, default: '', maxlength: 20000 },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_diamond_settings', timestamps: true }
);

export const FoodDiamondSettings = mongoose.model('FoodDiamondSettings', diamondSettingsSchema);
