import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const { FoodRestaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js');
const { signPendingApprovalToken, getPendingApprovalStatus } = await import('../src/core/auth/auth.service.js');
const r = await FoodRestaurant.findOne({ status: 'approved' }).select('_id restaurantName').lean();
const tok = signPendingApprovalToken('RESTAURANT', r._id);
const res = await getPendingApprovalStatus(tok);
console.log(r.restaurantName, '->', res.status, 'hasToken=', Boolean(res.accessToken), 'user=', res.user?.restaurantName);
const pend = await FoodRestaurant.findOne({ status: 'pending' }).select('_id').lean();
if (pend) console.log('pending ->', (await getPendingApprovalStatus(signPendingApprovalToken('RESTAURANT', pend._id))).status);
try { await getPendingApprovalStatus(tok.slice(0,-3)+'abc'); } catch (e) { console.log('tampered ->', e.message); }
await mongoose.disconnect();
