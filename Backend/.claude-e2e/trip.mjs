import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const { FoodOrder } = await import('../src/modules/food/orders/models/order.model.js');
const { getDeliveryPartnerTripHistory } = await import('../src/modules/food/delivery/services/delivery.service.js');
const o = await FoodOrder.findOne({ orderStatus: 'delivered', 'dispatch.deliveryPartnerId': { $exists: true } }).sort({ createdAt: -1 }).lean();
console.log('order', o?.orderId, o?.createdAt, String(o?.dispatch?.deliveryPartnerId));
const id = String(o.dispatch.deliveryPartnerId);
const day = o.createdAt.toISOString().slice(0,10);
for (const [period,status] of [['daily',undefined],['daily','Completed'],['weekly',undefined],['monthly','Completed']]) {
  const r = await getDeliveryPartnerTripHistory(id, { period, date: day, status, limit: 100 });
  console.log(period, status, r.trips.length, r.range.start, r.range.end);
}
await mongoose.disconnect();
