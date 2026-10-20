import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
const RID = '6a8c923e0c0dc5c805924c6d';
const BK = new URL('./hours-backup.json', import.meta.url);
await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('food_restaurant_outlet_timings');
const rcol = mongoose.connection.db.collection('food_restaurants');
const mode = process.argv[2];
const doc = await col.findOne({ restaurantId: new mongoose.Types.ObjectId(RID) });
const rest = await rcol.findOne({ _id: new mongoose.Types.ObjectId(RID) }, { projection: { openingTime: 1, closingTime: 1, openDays: 1 } });
if (mode === 'show') console.log(JSON.stringify(doc, null, 1).slice(0, 1500), rest);
if (mode === 'open') {
  if (!fs.existsSync(BK)) fs.writeFileSync(BK, JSON.stringify({ doc, rest }));
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  if (Array.isArray(doc?.timings)) {
    const t = doc.timings.map((d) => ({ ...d, isOpen: true, openingTime: '00:00', closingTime: '23:59' }));
    await col.updateOne({ _id: doc._id }, { $set: { timings: t } });
  }
  await rcol.updateOne({ _id: rest._id }, { $set: { openingTime: '00:00', closingTime: '23:59', openDays: days } });
  console.log('opened 24x7');
}
if (mode === 'restore') {
  const b = JSON.parse(fs.readFileSync(BK, 'utf8'));
  if (b.doc) await col.replaceOne({ _id: b.doc._id }, { ...b.doc, _id: b.doc._id, restaurantId: new mongoose.Types.ObjectId(String(b.doc.restaurantId)) });
  await rcol.updateOne({ _id: rest._id }, { $set: { openingTime: b.rest.openingTime, closingTime: b.rest.closingTime, openDays: b.rest.openDays } });
  fs.unlinkSync(BK); console.log('restored');
}
await mongoose.disconnect();
