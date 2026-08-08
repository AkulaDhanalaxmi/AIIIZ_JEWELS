require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./models/Setting');

async function run(){
  await mongoose.connect(process.env.MONGO_URI);
  const s = await Setting.findOne({ key: 'home_banner' }).lean();
  console.log(JSON.stringify(s, null, 2));
  await mongoose.disconnect();
}
run().catch(e=>{ console.error(e); process.exit(1); });
