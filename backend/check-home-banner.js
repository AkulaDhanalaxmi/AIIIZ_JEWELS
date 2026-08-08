require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./models/Setting');

async function run(){
  try{
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const s = await Setting.findOne({ key: 'home_banner' }).lean();
    if(!s || !s.value){ console.log('No home_banner setting'); await mongoose.disconnect(); process.exit(0); }
    const img = s.value.image || '';
    const isData = typeof img === 'string' && img.startsWith('data:image');
    const isCloud = typeof img === 'string' && img.startsWith('https://res.cloudinary.com');
    console.log(`home_banner image startsWith data:image: ${isData} | startsWith cloudinary: ${isCloud}`);
    if(isCloud) console.log('URL:', img);
    await mongoose.disconnect();
    process.exit(0);
  }catch(e){ console.error('Error', e); try{ await mongoose.disconnect(); }catch(_){}; process.exit(1); }
}
run();
