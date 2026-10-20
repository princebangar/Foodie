import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const o = await mongoose.connection.db.collection('food_orders').find({}).sort({ createdAt: -1 }).limit(1).toArray();
console.log(o[0].orderId, o[0].orderStatus, JSON.stringify(o[0].items.map(i => ({ n: i.name, q: i.quantity, p: i.price, t: i.itemType }))), 'total', o[0].pricing?.total);
await mongoose.disconnect();
