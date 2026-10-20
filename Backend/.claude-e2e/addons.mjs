import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const a = await mongoose.connection.db.collection('food_addons').find({}).project({ restaurantId: 1, approvalStatus: 1, isAvailable: 1, isDeleted: 1, 'published.name': 1, 'published.price': 1 }).toArray();
console.log(JSON.stringify(a));
await mongoose.disconnect();
