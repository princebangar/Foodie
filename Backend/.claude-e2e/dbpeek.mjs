import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const zones = await db.collection('food_zones').find({}, { projection: { name: 1, zoneName: 1, isActive: 1, 'coordinates': { $slice: 1 } } }).toArray();
console.log('zones', zones.map(z => `${z._id} ${z.name || z.zoneName} active=${z.isActive} c0=${JSON.stringify(z.coordinates?.[0])}`));
const rests = await db.collection('food_restaurants').find({ status: 'approved' }, { projection: { restaurantName: 1, ownerPhone: 1, zoneId: 1, 'location.latitude': 1, 'location.longitude': 1, isAcceptingOrders: 1, 'diningSettings': 1 } }).limit(15).toArray();
for (const r of rests) {
  const items = await db.collection('food_items').countDocuments({ restaurantId: r._id, approvalStatus: 'approved' });
  console.log('rest', String(r._id), r.restaurantName, r.ownerPhone, 'zone', String(r.zoneId), r.location?.latitude, r.location?.longitude, 'items', items, 'accepting', r.isAcceptingOrders, JSON.stringify(r.diningSettings));
}
const dps = await db.collection('food_delivery_partners').find({ status: 'approved' }, { projection: { name: 1, phone: 1, zoneId: 1 } }).limit(5).toArray();
console.log('riders', dps.map(d => `${d.name} ${d.phone} zone=${d.zoneId}`));
const users = await db.collection('food_users').find({ name: { $regex: /\S/ } }, { projection: { name: 1, phone: 1 } }).limit(3).toArray();
console.log('users', users.map(u => `${u.name} ${u.phone}`));
const admins = await db.collection('food_admins').find({}, { projection: { email: 1, name: 1 } }).limit(3).toArray().catch(() => []);
console.log('admins', admins.map(a => a.email));
console.log('collections', (await db.listCollections().toArray()).map(c => c.name).filter(n => /admin|commission|notif/.test(n)));
await mongoose.disconnect();
