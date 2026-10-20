import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const o = await mongoose.connection.db.collection('food_orders').findOne({ orderId: process.argv[2] });
const flat = (obj, p = '') => Object.entries(obj || {}).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !v._bsontype ? flat(v, p + k + '.') : [[p + k, v]]);
console.log(flat(o).filter(([k]) => /otp|code|status|riderEarning|pricing\.(total|subtotal|deliveryFee|restaurantCommission)|prepar|accepted/i.test(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n'));
await mongoose.disconnect();
