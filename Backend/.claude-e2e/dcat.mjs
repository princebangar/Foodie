import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const names = (await db.listCollections().toArray()).map(c => c.name).filter(n => /dining/i.test(n));
console.log(names);
for (const n of names) { const docs = await db.collection(n).find({}).limit(5).toArray(); console.log(n, docs.length, JSON.stringify(docs.map(d => ({ name: d.name, slug: d.slug, status: d.status, diningType: d.diningType, isActive: d.isActive }))).slice(0, 600)); }
await mongoose.disconnect();
