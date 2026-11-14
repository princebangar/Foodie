import mongoose from 'mongoose';

/**
 * One document per purchase. `pending` is created with the Razorpay order and becomes
 * `active` only after the payment is verified. A renewal starts when the current one ends.
 */
const diamondMembershipSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        status: { type: String, enum: ['pending', 'active', 'failed', 'cancelled'], default: 'pending', index: true },
        startAt: { type: Date, default: null },
        endAt: { type: Date, default: null, index: true },
        amount: { type: Number, min: 0, required: true },
        durationDays: { type: Number, min: 1, required: true },
        payment: {
            method: { type: String, enum: ['razorpay', 'dev'], default: 'razorpay' },
            razorpayOrderId: { type: String, default: '' },
            razorpayPaymentId: { type: String, default: '' },
            razorpaySignature: { type: String, default: '' },
            paidAt: { type: Date, default: null }
        },
        cancelledReason: { type: String, default: '' }
    },
    { collection: 'food_diamond_memberships', timestamps: true }
);

diamondMembershipSchema.index({ 'payment.razorpayOrderId': 1 }, { unique: true, partialFilterExpression: { 'payment.razorpayOrderId': { $type: 'string', $gt: '' } } });
diamondMembershipSchema.index({ userId: 1, status: 1, endAt: -1 });

export const FoodDiamondMembership = mongoose.model('FoodDiamondMembership', diamondMembershipSchema);
