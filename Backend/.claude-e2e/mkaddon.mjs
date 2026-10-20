import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('food_addons');
if (process.argv[2] === 'del') { const r = await col.deleteMany({ 'published.name': 'E2E Extra Masala' }); console.log('deleted', r.deletedCount); }
else {
  const payload = { name: 'E2E Extra Masala', description: 'test add-on', price: 20, image: '', images: [] };
  const r = await col.insertOne({ restaurantId: new mongoose.Types.ObjectId('6a8c923e0c0dc5c805924c6d'), draft: payload, published: payload, approvalStatus: 'approved', isAvailable: true, isDeleted: false, createdAt: new Date(), updatedAt: new Date() });
  console.log('addon', String(r.insertedId));
}
await mongoose.disconnect();
